import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import path from "node:path"
import { ProviderError, getJson } from "./http.ts"

/**
 * Version, update checks and self-update for the home server.
 *
 * Version: the Docker build records the Git tree hash of blackwall-admin/ in
 * build-info.json. Portainer deletes .git when it clones, so there's no commit
 * to read, but the tree hash is computed from the files alone and matches what
 * GitHub reports for that folder when the code is identical.
 *
 * Check: asks GitHub (with a read-only token) for the newest commit on the
 * branch that touched blackwall-admin/, and that commit's tree hash for it.
 *
 * Update: POSTs to the Portainer stack webhook. Portainer answers at once and
 * then, in the background, pulls the branch, rebuilds the images and recreates
 * the containers whose image changed, including this one. The panel watches
 * for a new process (bootId) to know it's done. The webhook URL only redeploys
 * this one stack; it can't do anything else.
 */

export interface BuildInfo {
  tree: string
  builtAt: string
}

export interface UpdateConfig {
  webhook?: string
  insecureTls?: boolean
  githubToken?: string
  repo: string
  ref: string
  path: string
}

export type UpdateState =
  | { state: "idle" }
  /** Calling the webhook. */
  | { state: "running"; at: string }
  /** Portainer accepted it. In webhook mode it pulls, builds and redeploys in the background. */
  | { state: "accepted"; at: string }
  | { state: "failed"; at: string; message: string }

export interface UpdateCheck {
  upToDate: boolean
  running: string
  latest: { tree: string; commit: string; message: string; date: string; url: string }
  checkedAt: string
}

export function updateConfigFromEnv(env: NodeJS.ProcessEnv): UpdateConfig {
  return {
    webhook: env.BLACKWALL_UPDATE_WEBHOOK || undefined,
    insecureTls: env.BLACKWALL_UPDATE_INSECURE_TLS === "1" || env.BLACKWALL_UPDATE_INSECURE_TLS === "true",
    githubToken: env.BLACKWALL_UPDATE_GITHUB_TOKEN || undefined,
    repo: env.BLACKWALL_UPDATE_REPO || "BCnD-Labs/bcndlabsadmin",
    ref: env.BLACKWALL_UPDATE_REF || "main",
    path: (env.BLACKWALL_UPDATE_PATH || "blackwall-admin").replace(/^\/+|\/+$/g, ""),
  }
}

export function readBuildInfo(file: string): BuildInfo | null {
  if (!existsSync(file)) return null
  try {
    const b = JSON.parse(readFileSync(file, "utf8")) as Partial<BuildInfo>
    return typeof b.tree === "string" && /^[0-9a-f]{40}$/.test(b.tree) && typeof b.builtAt === "string" ? { tree: b.tree, builtAt: b.builtAt } : null
  } catch {
    return null
  }
}

export class System {
  /** Changes every time the process starts, so the panel can tell it restarted. */
  readonly bootId = randomUUID()
  readonly startedAt = new Date().toISOString()
  private update: UpdateState = { state: "idle" }
  private lastCheck?: { at: number; result: UpdateCheck }

  readonly build: BuildInfo | null
  private readonly config: UpdateConfig

  constructor(build: BuildInfo | null, config: UpdateConfig) {
    this.build = build
    this.config = config
  }

  static fromEnv(rootDir: string, env = process.env) {
    return new System(readBuildInfo(path.join(rootDir, "build-info.json")), updateConfigFromEnv(env))
  }

  info() {
    const c = this.config
    // Don't report an accepted update forever if this process was never replaced.
    if (this.update.state === "accepted" && Date.now() - new Date(this.update.at).getTime() > 10 * 60_000) this.update = { state: "idle" }
    return {
      mode: "server" as const,
      build: this.build,
      bootId: this.bootId,
      startedAt: this.startedAt,
      node: process.version,
      updates: {
        repo: c.repo,
        ref: c.ref,
        path: c.path,
        canCheck: !!(c.githubToken && this.build),
        canUpdate: !!c.webhook,
        missing: [
          !c.githubToken && "BLACKWALL_UPDATE_GITHUB_TOKEN",
          !c.webhook && "BLACKWALL_UPDATE_WEBHOOK",
        ].filter(Boolean) as string[],
      },
      update: this.update,
    }
  }

  /** Compare the running build with the newest version of the folder on GitHub. Cached for a minute. */
  async check(force = false): Promise<UpdateCheck> {
    const c = this.config
    if (!this.build) throw new ProviderError("This build has no version stamp (it wasn't built by the Dockerfile).", 409)
    if (!c.githubToken) throw new ProviderError("Set BLACKWALL_UPDATE_GITHUB_TOKEN in the stack to check for updates.", 409)
    if (!force && this.lastCheck && Date.now() - this.lastCheck.at < 60_000) return this.lastCheck.result

    const headers = {
      Authorization: `Bearer ${c.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "blackwall",
    }
    const api = `https://api.github.com/repos/${c.repo}`
    type Commit = { sha: string; html_url: string; commit: { message: string; committer: { date: string }; tree: { sha: string } } }
    const commits = await getJson<Commit[]>(
      `${api}/commits?sha=${encodeURIComponent(c.ref)}&path=${encodeURIComponent(c.path)}&per_page=1`,
      { headers },
      "GitHub",
    )
    const latest = commits[0]
    if (!latest) throw new ProviderError(`GitHub has no commits touching ${c.path}/ on ${c.ref}`, 404)

    // Walk from the commit's root tree down to the folder.
    let tree = latest.commit.tree.sha
    for (const segment of c.path.split("/").filter(Boolean)) {
      const t = await getJson<{ tree: { path: string; type: string; sha: string }[] }>(`${api}/git/trees/${tree}`, { headers }, "GitHub")
      const entry = t.tree.find((e) => e.path === segment && e.type === "tree")
      if (!entry) throw new ProviderError(`${c.path}/ isn't in ${c.repo} on ${c.ref}`, 404)
      tree = entry.sha
    }

    const result: UpdateCheck = {
      upToDate: tree === this.build.tree,
      running: this.build.tree,
      latest: {
        tree,
        commit: latest.sha,
        message: latest.commit.message.split("\n")[0].slice(0, 200),
        date: latest.commit.committer.date,
        url: latest.html_url,
      },
      checkedAt: new Date().toISOString(),
    }
    this.lastCheck = { at: Date.now(), result }
    // An accepted update that ends with the latest code already running means Portainer had nothing to rebuild.
    if (result.upToDate && this.update.state === "accepted") this.update = { state: "idle" }
    return result
  }

  /**
   * Ask Portainer to redeploy. Returns at once. Portainer's webhook also answers
   * at once (204) and does the work in the background, so a 2xx only means
   * "accepted"; the panel then waits for this process to be replaced.
   */
  startUpdate(): UpdateState {
    if (!this.config.webhook) throw new ProviderError("Set BLACKWALL_UPDATE_WEBHOOK in the stack to update from here.", 409)
    if (this.update.state === "running") throw new ProviderError("An update is already being requested.", 409)
    this.update = { state: "running", at: new Date().toISOString() }
    this.lastCheck = undefined
    console.log("[blackwall] update requested; calling the Portainer webhook")
    void postWebhook(this.config.webhook, !!this.config.insecureTls).then(
      ({ status, body }) => {
        const at = new Date().toISOString()
        if (status >= 200 && status < 300) {
          this.update = { state: "accepted", at }
          console.log(`[blackwall] Portainer accepted the update (HTTP ${status}); it pulls and rebuilds in the background`)
          return
        }
        const detail = portainerMessage(body)
        const hint =
          status === 404
            ? "Portainer doesn't recognise this webhook. Copy the URL again from the stack's GitOps settings."
            : /autoupdate/i.test(detail)
              ? "Turn on GitOps updates (mechanism: Webhook) for the stack in Portainer."
              : /in progress/i.test(detail)
                ? "Portainer is already deploying this stack. Wait for it to finish."
                : ""
        this.update = { state: "failed", at, message: [`Portainer answered HTTP ${status}${detail ? `: ${detail}` : ""}.`, hint].filter(Boolean).join(" ") }
        console.log(`[blackwall] update failed: ${this.update.message}`)
      },
      (e: Error) => {
        this.update = { state: "failed", at: new Date().toISOString(), message: `Couldn't reach Portainer: ${e.message}` }
        console.log(`[blackwall] update failed: ${this.update.message}`)
      },
    )
    return this.update
  }
}

function portainerMessage(body: string): string {
  try {
    const j = JSON.parse(body) as { message?: string; details?: string }
    return [j.message, j.details].filter(Boolean).join(" – ").slice(0, 300)
  } catch {
    return body.slice(0, 200)
  }
}

/**
 * POST with no body. node:https instead of fetch so a self-signed Portainer
 * certificate can be accepted for this one request when the stack opts in.
 * No timeout on the response: a redeploy includes an image build.
 */
function postWebhook(url: string, insecureTls: boolean): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let u: URL
    try {
      u = new URL(url)
    } catch {
      return reject(new Error("BLACKWALL_UPDATE_WEBHOOK isn't a valid URL"))
    }
    const send = u.protocol === "https:" ? httpsRequest : u.protocol === "http:" ? httpRequest : null
    if (!send) return reject(new Error("BLACKWALL_UPDATE_WEBHOOK must start with http:// or https://"))
    const req = send(u, { method: "POST", headers: { "Content-Length": "0" }, ...(u.protocol === "https:" ? { rejectUnauthorized: !insecureTls } : {}) }, (res) => {
      let body = ""
      res.setEncoding("utf8")
      res.on("data", (chunk: string) => {
        if (body.length < 10_000) body += chunk
      })
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }))
    })
    // Fail fast if Portainer can't be reached at all; once connected, wait as long as the build takes.
    req.setTimeout(15_000, () => {
      if (!req.socket?.remoteAddress) req.destroy(new Error("timed out connecting"))
    })
    req.on("socket", (s) => s.on("connect", () => req.setTimeout(0)))
    req.on("error", reject)
    req.end()
  })
}
