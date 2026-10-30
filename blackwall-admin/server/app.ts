import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { PROVIDERS, type ConnectionInput, type ProviderId } from "../shared/connections.ts"
import { LoginLimiter, Sessions, verifyPassword } from "./auth.ts"
import { ProviderError } from "./http.ts"
import { analyticsReport } from "./providers/analytics.ts"
import { githubOverview } from "./providers/github.ts"
import { testConnection } from "./providers/index.ts"
import { toPublic, type ConnectionStore } from "./store.ts"

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
  /** Exact Host header values (with port if any) besides loopback. */
  allowedHosts?: string[]
  /** Set on the home server; the local dev connector runs without a login. */
  auth?: { passwordHash: string; sessions: Sessions }
  /** Directory the backup job writes to, mounted read-only. */
  backupDir?: string
  /** Extra health info, e.g. a database ping. */
  health?: () => Promise<Record<string, unknown>>
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(status === 204 ? undefined : JSON.stringify(body))
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) throw new ProviderError("Request too large", 413)
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
  const limiter = new LoginLimiter()

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
      const client = req.socket.remoteAddress ?? "?"
      if (limiter.blocked(client)) return send(res, 429, { error: "Too many attempts. Try again in a few minutes." })
      const { password } = await readJson<{ password?: string }>(req)
      if (typeof password !== "string" || !verifyPassword(password, auth.passwordHash)) {
        limiter.fail(client)
        return send(res, 401, { error: "Wrong password" })
      }
      return send(res, 200, { authenticated: true }, { "Set-Cookie": auth.sessions.issue(secure) })
    }
    if (parts[0] === "logout" && method === "POST") {
      return send(res, 200, { authenticated: false }, auth ? { "Set-Cookie": auth.sessions.clear(secure) } : {})
    }
    if (!signedIn) return send(res, 401, { error: "Sign in required" })

    // --- health & backups ------------------------------------------------------
    if (parts[0] === "health") {
      return send(res, 200, { ok: true, store: store.where, ...(opts.health ? await opts.health() : {}) })
    }
    if (parts[0] === "backups" && method === "GET") {
      return send(res, 200, opts.backupDir ? readBackups(opts.backupDir) : { configured: false })
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
      const c = await store.firstOk("github")
      if (!c) return send(res, 409, { error: "GitHub is not connected" })
      const repos = (url.searchParams.get("repos") ?? "").split(",").filter(Boolean)
      return send(res, 200, await githubOverview(c, repos))
    }

    // GET /api/analytics/report?days=30
    if (parts[0] === "analytics" && parts[1] === "report") {
      const c = await store.firstOk("analytics")
      if (!c) return send(res, 409, { error: "Analytics is not connected" })
      const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365)
      return send(res, 200, await analyticsReport(c, days))
    }

    send(res, 404, { error: "Not found" })
  }
}
