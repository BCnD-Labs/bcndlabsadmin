import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { PROVIDERS, type ConnectionInput, type ProviderId } from "../shared/connections.ts"
import { LoginLimiter, Sessions, verifyPassword } from "./auth.ts"
import { ProviderError } from "./http.ts"
import { analyticsReport } from "./providers/analytics.ts"
import { githubOverview } from "./providers/github.ts"
import { deleteImage, publishPost, siteChrome, siteMedia, siteOverview, siteRaw, unpublishPost, uploadImage } from "./providers/website.ts"
import { SLUG_RE, cleanPost, type ScheduledPost, type SitePost } from "../shared/site.ts"
import { testConnection } from "./providers/index.ts"
import { toPublic, type ConnectionStore } from "./store.ts"
import { validWorkspace } from "../shared/workspace.ts"
import { serviceIcon } from "./icons.ts"
import { checkServices, validStatusUrls } from "./service-status.ts"
import { Notifier } from "./notify.ts"
import { collectInbox, deleteInbox, readInbox, setInboxStatus } from "./forms-inbox.ts"
import { checkLive, publishSite } from "./site-publish.ts"
import { handleStorage } from "./storage.ts"
import type { WorkspaceStore } from "./workspace.ts"
import type { System } from "./system.ts"
import { MAC, type UpdatesDir, readUpdateManifest } from "./app-updates.ts"

/**
 * Blackwall's JSON API (/api/*). The same handler runs inside Vite on a dev
 * machine and in the standalone server on the home server. It holds every
 * credential and makes every external call, so tokens never reach a browser.
 *
 * Every request must carry `X-Blackwall: 1` (other sites can't send it without
 * a CORS preflight, which is never approved) and use an allowed Host.
 */
export interface ApiOptions {
  store: ConnectionStore
  workspace: WorkspaceStore
  /** Exact Host header values (with port if any) besides loopback. */
  allowedHosts?: string[]
  /** Set on the home server; the local dev connector runs without a login. */
  auth?: { passwordHash: string; sessions: Sessions }
  /** Directory the backup job writes to, mounted read-only. */
  backupDir?: string
  /** Extra health info, e.g. a database ping. */
  health?: () => Promise<Record<string, unknown>>
  /** Version, update check and self-update (home server only). */
  system?: System
  /** Folder holding android.json and the .apk it names, or a function that picks it (see app-updates.ts). */
  appUpdatesDir?: UpdatesDir
  /** Runs before the manifest is read, e.g. to pull the newest build from GitHub first. Must not throw. */
  beforeAppUpdates?: () => Promise<void>
  /** The same for the Mac app: a folder holding mac.json and the .dmg it names. */
  macUpdatesDir?: UpdatesDir
  beforeMacUpdates?: () => Promise<void>
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/**
 * Who is signing in, for the login limiter. On the home server the app is only
 * published on 127.0.0.1, so requests arrive through `tailscale serve` (or
 * Docker's port proxy), and the socket address is the same for every device.
 * Serve puts the real tailnet address in X-Forwarded-For; the rightmost entry
 * is the one the proxy added, so a client can't pick its own bucket.
 */
export function clientAddress(req: IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"]
  const last = (Array.isArray(xff) ? xff.join(",") : (xff ?? ""))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .at(-1)
  return last ?? req.socket.remoteAddress ?? "?"
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(status === 204 ? undefined : JSON.stringify(body))
}

async function readJson<T>(req: IncomingMessage, limit = 64 * 1024): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new ProviderError("Request too large", 413)
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as T
  } catch {
    throw new ProviderError("Invalid JSON", 400)
  }
}

function validInput(body: Partial<ConnectionInput>, partial = false): ConnectionInput {
  const known = PROVIDERS.some((p) => p.id === body.provider)
  if (!partial && !known) throw new ProviderError("Unknown provider", 400)
  const strings = (o: unknown) =>
    o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" || v === null)) : {}
  return {
    provider: body.provider as ProviderId,
    label: typeof body.label === "string" ? body.label.slice(0, 80) : "",
    config: strings(body.config) as Record<string, string>,
    secrets: strings(body.secrets) as Record<string, string | null>,
  }
}

/** An explicit read-only feed source must never silently fall back to another account. */
async function feedConnection(store: ConnectionStore, provider: "github" | "analytics", id: string | null) {
  if (!id) return store.firstOk(provider)
  const connection = await store.get(id)
  if (!connection || connection.provider !== provider) throw new ProviderError("The selected data source is unavailable. Choose another in Settings → Connections.", 409)
  if (connection.status !== "ok") throw new ProviderError("The selected data source needs attention. Test it in Settings → Connections.", 409)
  return connection
}

/** Recent backup files plus the backup job's last status file, if present. */
function readBackups(dir: string) {
  if (!existsSync(dir)) return { configured: false as const }
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("blackwall-") && !f.endsWith(".tmp"))
    .map((f) => {
      const st = statSync(path.join(dir, f))
      return { name: f, bytes: st.size, at: st.mtime.toISOString() }
    })
    .sort((a, b) => b.at.localeCompare(a.at))
  let status: unknown
  try {
    status = JSON.parse(readFileSync(path.join(dir, "last-status.json"), "utf8"))
  } catch {
    status = undefined
  }
  return { configured: true as const, files: files.slice(0, 30), count: files.length, status }
}

export function createApi(opts: ApiOptions) {
  const allowed = new Set(opts.allowedHosts ?? [])
  // 10 failed logins per device per 15 minutes, and 30 in total across all devices.
  const limiter = new LoginLimiter(10)
  const everyone = new LoginLimiter(30)

  // Scheduled posts: once a minute, publish any whose time has come. A failure is
  // kept (with its error, shown in the CMS) and retried every 10 minutes.
  const notifier = new Notifier({
    store: opts.store,
    readWorkspace: () => opts.workspace.readWorkspace(),
    checkServices: (urls) => checkServices(urls),
    githubOverview,
    readBackups: opts.backupDir ? () => readBackups(opts.backupDir!) : undefined,
    checkUpdate: opts.system ? () => opts.system!.check(false) : undefined,
    baseUrl: opts.allowedHosts?.[0] ? `https://${opts.allowedHosts[0]}` : undefined,
  })
  // Watch services, backups, connections, GitHub and due work once a minute.
  const watch = setInterval(() => void notifier.tick().catch(() => {}), 60_000)
  watch.unref?.()
  setTimeout(() => void notifier.tick().catch(() => {}), 5_000).unref?.()

  // Form messages, comments and sign-ups: collect from the form receiver once a minute.
  const collect = async () => collectInbox(opts.store, (await opts.workspace.readWorkspace().catch(() => undefined))?.data, (event, m) => notifier.emit(event, m))
  const inboxTimer = setInterval(() => void collect().catch(() => {}), 60_000)
  inboxTimer.unref?.()
  setTimeout(() => void collect().catch(() => {}), 8_000).unref?.()

  const publishDue = async () => {
    const due = (await opts.store.listSchedules()).filter(
      (s) => Date.parse(s.publishAt) <= Date.now() && (!s.triedAt || Date.now() - Date.parse(s.triedAt) > 10 * 60_000),
    )
    if (!due.length) return
    const site = await opts.store.firstOk("website")
    for (const s of due) {
      try {
        if (!site) throw new Error("Website publishing isn't connected")
        await publishPost(site, { ...s.post, date: s.publishAt })
        await opts.store.deleteSchedule(s.post.slug)
        await notifier.siteCleared(s.post.slug)
        await notifier.sitePublished(s.post.title).catch(() => {})
      } catch (e) {
        await opts.store.putSchedule({ ...s, error: (e as Error).message, triedAt: new Date().toISOString() })
        await notifier.siteFailed(s.post.slug, s.post.title, (e as Error).message).catch(() => {})
      }
    }
  }
  const timer = setInterval(() => void publishDue().catch(() => {}), 60_000)
  timer.unref?.()
  void publishDue().catch(() => {})

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    try {
      await route(req, res)
    } catch (e) {
      send(res, e instanceof ProviderError ? e.status : 500, { error: (e as Error).message })
    }
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    const host = req.headers.host ?? ""
    if (!(LOOPBACK.test(host) || allowed.has(host)) || req.headers["x-blackwall"] !== "1") {
      return send(res, 403, { error: "Forbidden" })
    }
    const secure = !LOOPBACK.test(host)
    const url = new URL(req.url ?? "/", "http://localhost")
    const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean)
    const method = req.method ?? "GET"
    const { store, auth } = opts
    const signedIn = !auth || auth.sessions.valid(req)

    // --- session -------------------------------------------------------------
    if (parts[0] === "session" && method === "GET") {
      return send(res, 200, { authRequired: !!auth, authenticated: signedIn })
    }
    if (parts[0] === "login" && method === "POST") {
      if (!auth) return send(res, 200, { authenticated: true })
      const client = clientAddress(req)
      if (limiter.blocked(client) || everyone.blocked("*")) {
        return send(res, 429, { error: "Too many attempts. Try again in a few minutes." })
      }
      const { password, remember } = await readJson<{ password?: string; remember?: unknown }>(req)
      if (typeof password !== "string" || !verifyPassword(password, auth.passwordHash)) {
        limiter.fail(client)
        everyone.fail("*")
        return send(res, 401, { error: "Wrong password" })
      }
      // Only an explicit `true` remembers; anything else gets the short browser-session login.
      return send(res, 200, { authenticated: true }, { "Set-Cookie": auth.sessions.issue(secure, remember === true) })
    }
    if (parts[0] === "logout" && method === "POST") {
      return send(res, 200, { authenticated: false }, auth ? { "Set-Cookie": auth.sessions.clear(secure) } : {})
    }
    // The app update manifest is public like the download it names (see app-updates.ts).
    if (parts[0] === "app-updates" && parts[1] === "android.json" && parts.length === 2 && method === "GET") {
      await opts.beforeAppUpdates?.()
      const manifest = readUpdateManifest(opts.appUpdatesDir)
      return manifest ? send(res, 200, manifest, { "Cache-Control": "no-cache" }) : send(res, 404, { error: "No app update is published" })
    }
    if (parts[0] === "app-updates" && parts[1] === "mac.json" && parts.length === 2 && method === "GET") {
      await opts.beforeMacUpdates?.()
      const manifest = readUpdateManifest(opts.macUpdatesDir, MAC)
      return manifest ? send(res, 200, manifest, { "Cache-Control": "no-cache" }) : send(res, 404, { error: "No Mac update is published" })
    }
    if (!signedIn) return send(res, 401, { error: "Sign in required" })

    if (parts[0] === "workspace" && parts.length === 1) {
      if (method === "GET") return send(res, 200, await opts.workspace.readWorkspace())
      if (method === "PUT") {
        const body = await readJson<{ id?: unknown; revision?: unknown; data?: unknown }>(req, 16 * 1024 * 1024)
        if (typeof body.id !== "string" || typeof body.revision !== "number" || !Number.isSafeInteger(body.revision) || body.revision < 0 || !validWorkspace(body.data)) {
          throw new ProviderError("Invalid workspace. No data was changed.", 400)
        }
        const saved = await opts.workspace.writeWorkspace(body.id, body.revision, body.data)
        if (!saved) return send(res, 409, { error: "Workspace changed on another device. Refresh and merge before saving." })
        return send(res, 200, saved)
      }
      return send(res, 405, { error: "Method not allowed" })
    }

    // --- Mikoshi storage (Nextcloud over WebDAV) --------------------------------
    if (parts[0] === "storage") {
      return handleStorage(store, req, res, url, parts.slice(1).join("/"), method, (status, body) => send(res, status, body), (limit) => readJson(req, limit))
    }

    // --- CMS sites: build and commit ------------------------------------------
    if (parts[0] === "sites" && parts[2] === "publish" && method === "POST" && parts[1]) {
      return send(res, 200, await publishSite(store, (await opts.workspace.readWorkspace()).data, parts[1]))
    }
    if (parts[0] === "sites" && parts[2] === "live" && method === "POST" && parts[1]) {
      const body = await readJson(req) as { removed?: unknown }
      return send(res, 200, await checkLive(store, (await opts.workspace.readWorkspace()).data, parts[1], Array.isArray(body?.removed) ? body.removed.filter((p): p is string => typeof p === "string") : []))
    }

    // --- site inbox (form receiver) ----------------------------------------------
    if (parts[0] === "inbox") {
      if (!parts[1] && method === "GET") return send(res, 200, { items: await readInbox(store) })
      if (parts[1] === "collect" && method === "POST") {
        const r = await collect()
        return send(res, 200, { ...r, items: await readInbox(store) })
      }
      if (!parts[1] && method === "PATCH") {
        const { ids, status } = await readJson<{ ids?: string[]; status?: string }>(req)
        if (!Array.isArray(ids)) return send(res, 400, { error: "ids required" })
        return send(res, 200, { items: await setInboxStatus(store, ids, status as never) })
      }
      if (!parts[1] && method === "DELETE") {
        const { ids } = await readJson<{ ids?: string[] }>(req)
        if (!Array.isArray(ids)) return send(res, 400, { error: "ids required" })
        return send(res, 200, { items: await deleteInbox(store, ids) })
      }
    }

    // --- notifications ---------------------------------------------------------
    if (parts[0] === "notifications") {
      if (!parts[1] && method === "GET") return send(res, 200, { items: await notifier.feed() })
      if (parts[1] === "read" && method === "POST") {
        const body = await readJson<{ ids?: unknown; all?: boolean }>(req)
        const ids = body.all ? "all" : Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : []
        return send(res, 200, { items: await notifier.markRead(ids) })
      }
      if (parts[1] === "settings" && method === "GET") return send(res, 200, { settings: await notifier.settings(), errors: await notifier.deliveryErrors() })
      if (parts[1] === "settings" && method === "PUT") return send(res, 200, { settings: await notifier.saveSettings(await readJson(req)) })
      if (parts[1] === "test" && method === "POST") {
        const { channel } = await readJson<{ channel?: string }>(req)
        if (channel !== "bell" && channel !== "ntfy" && channel !== "email") return send(res, 400, { error: "Pick bell, ntfy or email" })
        if (channel !== "bell" && !(await store.firstOk(channel))) return send(res, 409, { error: `${channel === "ntfy" ? "ntfy" : "Email"} isn't connected yet` })
        const sent = await notifier.emit("test", { title: "Test notification", body: `This is a test from Blackwall (${channel}).`, tags: ["bell"] }, { force: [channel] })
        if (!sent.includes(channel)) return send(res, 502, { error: (await notifier.deliveryErrors())[channel]?.message ?? "It didn't send" })
        return send(res, 200, { sent })
      }
      return send(res, 405, { error: "Method not allowed" })
    }

    // --- service status (Mikoshi launcher tiles) -------------------------------
    if (parts[0] === "services" && parts[1] === "status" && method === "POST") {
      const urls = validStatusUrls((await readJson<{ urls?: unknown }>(req)).urls)
      if (!urls) return send(res, 400, { error: "Send up to 60 http(s) addresses." })
      return send(res, 200, { checkedAt: new Date().toISOString(), results: await checkServices(urls) })
    }

    // --- service logos (Mikoshi launcher) ---------------------------------------
    if (parts[0] === "icons" && parts.length === 2 && method === "GET") {
      const result = await serviceIcon(store, parts[1])
      return "svg" in result ? send(res, 200, result, { "Cache-Control": "private, max-age=86400" }) : send(res, result.status, { error: result.error })
    }

    // --- health & backups ------------------------------------------------------
    if (parts[0] === "health") {
      return send(res, 200, { ok: true, store: store.where, ...(opts.health ? await opts.health() : {}) })
    }
    if (parts[0] === "backups" && method === "GET") {
      return send(res, 200, opts.backupDir ? readBackups(opts.backupDir) : { configured: false })
    }

    // --- version & updates -----------------------------------------------------
    if (parts[0] === "system") {
      const sys = opts.system
      if (!parts[1] && method === "GET") {
        return send(res, 200, sys ? sys.info() : { mode: "development", build: null, node: process.version })
      }
      if (!sys) return send(res, 409, { error: "Updates are only available on the home server." })
      if (parts[1] === "check" && method === "GET") return send(res, 200, await sys.check(url.searchParams.has("force")))
      if (parts[1] === "update" && method === "POST") return send(res, 202, { bootId: sys.bootId, update: sys.startUpdate() })
    }

    // --- connections -----------------------------------------------------------
    if (parts[0] === "connections") {
      const id = parts[1]
      if (!id && method === "GET") return send(res, 200, (await store.list()).map(toPublic))
      if (!id && method === "POST") {
        const created = await store.create(validInput(await readJson(req)))
        const tested = await store.setResult(created.id, await testConnection(created))
        return send(res, 201, toPublic(tested!))
      }
      const existing = id ? await store.get(id) : undefined
      if (!existing) return send(res, 404, { error: "No such connection" })
      if (parts[2] === "test" && method === "POST") {
        return send(res, 200, toPublic((await store.setResult(id, await testConnection(existing)))!))
      }
      if (method === "PUT") {
        const input = validInput(await readJson(req), true)
        const updated = await store.update(id, { label: input.label, config: input.config, secrets: input.secrets })
        return send(res, 200, toPublic((await store.setResult(id, await testConnection(updated!)))!))
      }
      if (method === "DELETE") {
        await store.remove(id)
        return send(res, 204, null)
      }
    }

    // GET /api/github/overview?repos=owner/a,owner/b
    if (parts[0] === "github" && parts[1] === "overview") {
      const c = await feedConnection(store, "github", url.searchParams.get("connection"))
      if (!c) return send(res, 409, { error: "GitHub is not connected" })
      const repos = (url.searchParams.get("repos") ?? "").split(",").filter(Boolean)
      return send(res, 200, await githubOverview(c, repos))
    }

    // GET /api/github/accounts?repos=owner/a~connectionId,owner/b
    // Every working GitHub connection, each with the repos assigned to it. Repos without an
    // assignment (or assigned to a connection that isn't usable) go to the first working one.
    if (parts[0] === "github" && parts[1] === "accounts") {
      const all = (await store.list()).filter((c) => c.provider === "github")
      const ok = all.filter((c) => c.status === "ok")
      if (!ok.length) return send(res, 409, { error: all.length ? "No GitHub connection is working. Test it in Settings → Connections." : "GitHub is not connected" })
      const wanted = (url.searchParams.get("repos") ?? "").split(",").filter(Boolean).slice(0, 40)
      const assigned = new Map<string, string[]>(ok.map((c) => [c.id, []]))
      for (const item of wanted) {
        const [repo, id] = item.split("~")
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) continue
        assigned.get(id && assigned.has(id) ? id : ok[0].id)!.push(repo)
      }
      const accounts = await Promise.all(ok.map(async (c) => {
        const repos = assigned.get(c.id)!
        const base = { connectionId: c.id, label: c.label, account: c.account, repos }
        try {
          return { ...base, overview: await githubOverview(c, repos) }
        } catch (e) {
          return { ...base, error: (e as Error).message }
        }
      }))
      return send(res, 200, { accounts })
    }

    // GET /api/analytics/report?days=30
    if (parts[0] === "analytics" && parts[1] === "report") {
      const c = await feedConnection(store, "analytics", url.searchParams.get("connection"))
      if (!c) return send(res, 409, { error: "Analytics is not connected" })
      const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365)
      return send(res, 200, await analyticsReport(c, days))
    }

    // --- website publishing (CMS) ----------------------------------------------
    if (parts[0] === "site") {
      const site = await store.firstOk("website")
      if (!site) return send(res, 409, { error: "Website publishing is not connected" })
      const what = parts[1]
      const slug = parts[2]
      if (what === "overview" && method === "GET") return send(res, 200, await siteOverview(site, await store.listSchedules()))
      if (what === "chrome" && method === "GET") return send(res, 200, await siteChrome(site))
      // PUT /api/site/posts/:slug  { post, previousSlug? }   DELETE /api/site/posts/:slug
      if (what === "posts" && slug && method === "PUT") {
        const body = await readJson<{ post?: Partial<SitePost>; previousSlug?: string }>(req, 2 * 1024 * 1024)
        const result = await publishPost(site, { ...body.post, slug }, body.previousSlug)
        await store.deleteSchedule(slug)
        return send(res, 200, result)
      }
      if (what === "posts" && slug && method === "DELETE") return send(res, 200, await unpublishPost(site, slug))
      // PUT /api/site/schedule/:slug  { post, publishAt }   DELETE /api/site/schedule/:slug
      if (what === "schedule" && slug && method === "PUT") {
        const body = await readJson<{ post?: Partial<SitePost>; publishAt?: string }>(req, 2 * 1024 * 1024)
        let post: SitePost
        try {
          post = cleanPost({ ...body.post, slug })
        } catch (e) {
          throw new ProviderError((e as Error).message, 400)
        }
        const at = Date.parse(body.publishAt ?? "")
        if (!Number.isFinite(at)) throw new ProviderError("Pick a date and time to publish", 400)
        if (at < Date.now() - 60_000) throw new ProviderError("That time has already passed. Publish now instead.", 400)
        const scheduled: ScheduledPost = { post: { ...post, date: new Date(at).toISOString() }, publishAt: new Date(at).toISOString(), createdAt: new Date().toISOString() }
        await store.putSchedule(scheduled)
        return send(res, 200, scheduled)
      }
      if (what === "schedule" && slug && method === "DELETE") {
        if (!SLUG_RE.test(slug)) throw new ProviderError("Bad slug", 400)
        await store.deleteSchedule(slug)
        return send(res, 204, null)
      }
      if (what === "media" && method === "GET") return send(res, 200, await siteMedia(site))
      if (what === "media" && method === "POST") {
        const body = await readJson<{ name?: string; data?: string }>(req, 12 * 1024 * 1024)
        if (typeof body.name !== "string" || typeof body.data !== "string") throw new ProviderError("Send a file name and its data", 400)
        return send(res, 201, await uploadImage(site, body.name, body.data))
      }
      if (what === "media" && method === "DELETE") {
        await deleteImage(site, url.searchParams.get("path") ?? "")
        return send(res, 204, null)
      }
      // GET /api/site/raw?path=/assets/blog_images/x.png  (image bytes, for previews before the site redeploys)
      if (what === "raw" && method === "GET") {
        const file = await siteRaw(site, url.searchParams.get("path") ?? "")
        if (!file) return send(res, 404, { error: "Not found" })
        const name = (url.searchParams.get("path") ?? "").toLowerCase()
        const type = name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".png") ? "image/png" : /\.jpe?g$/.test(name) ? "image/jpeg" : name.endsWith(".gif") ? "image/gif" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".avif") ? "image/avif" : "application/octet-stream"
        res.statusCode = 200
        res.setHeader("Content-Type", type)
        res.setHeader("Cache-Control", "private, max-age=300")
        res.setHeader("X-Content-Type-Options", "nosniff")
        res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        return res.end(file.body)
      }
    }

    send(res, 404, { error: "Not found" })
  }
}
