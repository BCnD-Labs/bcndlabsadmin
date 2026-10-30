import type { IncomingMessage, ServerResponse } from "node:http"
import type { Connect, Plugin } from "vite"
import { PROVIDERS, type ConnectionInput, type ProviderId } from "../shared/connections.ts"
import { ProviderError } from "./http.ts"
import { analyticsReport } from "./providers/analytics.ts"
import { githubOverview } from "./providers/github.ts"
import { testConnection } from "./providers/index.ts"
import { ConnectionStore, toPublic } from "./store.ts"

/**
 * Blackwall's local connector: a small JSON API mounted at /api on the Vite
 * dev and preview servers. It is the server-side boundary that holds
 * credentials and talks to external services, so tokens never reach the
 * browser or localStorage.
 *
 * Requests must carry `X-Blackwall: 1` (forces a CORS preflight that other
 * sites can't pass) and come from a loopback Host.
 */
export function blackwallConnector(root: string): Plugin {
  let store: ConnectionStore | undefined
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/")) return next()
    store ??= new ConnectionStore(root)
    handle(store, req, res).catch((e) => send(res, e instanceof ProviderError ? e.status : 500, { error: (e as Error).message }))
  }
  return {
    name: "blackwall-connector",
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  res.end(JSON.stringify(body))
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
    o && typeof o === "object"
      ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" || v === null))
      : {}
  return {
    provider: body.provider as ProviderId,
    label: typeof body.label === "string" ? body.label.slice(0, 80) : "",
    config: strings(body.config) as Record<string, string>,
    secrets: strings(body.secrets) as Record<string, string | null>,
  }
}

async function handle(store: ConnectionStore, req: IncomingMessage, res: ServerResponse) {
  if (!LOOPBACK.test(req.headers.host ?? "") || req.headers["x-blackwall"] !== "1") {
    return send(res, 403, { error: "Forbidden" })
  }
  const url = new URL(req.url ?? "/", "http://localhost")
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean)
  const method = req.method ?? "GET"

  // GET /api/health
  if (parts[0] === "health") return send(res, 200, { ok: true, storeFile: store.file })

  if (parts[0] === "connections") {
    const id = parts[1]
    if (!id && method === "GET") return send(res, 200, store.list().map(toPublic))
    if (!id && method === "POST") {
      const created = store.create(validInput(await readJson(req)))
      const tested = store.setResult(created.id, await testConnection(created))!
      return send(res, 201, toPublic(tested))
    }
    const existing = id ? store.get(id) : undefined
    if (!existing) return send(res, 404, { error: "No such connection" })
    if (parts[2] === "test" && method === "POST") {
      return send(res, 200, toPublic(store.setResult(id, await testConnection(existing))!))
    }
    if (method === "PUT") {
      const input = validInput(await readJson(req), true)
      const updated = store.update(id, { label: input.label, config: input.config, secrets: input.secrets })!
      return send(res, 200, toPublic(store.setResult(id, await testConnection(updated))!))
    }
    if (method === "DELETE") {
      store.remove(id)
      return send(res, 204, null)
    }
  }

  // GET /api/github/overview?repos=owner/a,owner/b
  if (parts[0] === "github" && parts[1] === "overview") {
    const c = store.firstOk("github")
    if (!c) return send(res, 409, { error: "GitHub is not connected" })
    const repos = (url.searchParams.get("repos") ?? "").split(",").filter(Boolean)
    return send(res, 200, await githubOverview(c, repos))
  }

  // GET /api/analytics/report?days=30
  if (parts[0] === "analytics" && parts[1] === "report") {
    const c = store.firstOk("analytics")
    if (!c) return send(res, 409, { error: "Analytics is not connected" })
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365)
    return send(res, 200, await analyticsReport(c, days))
  }

  send(res, 404, { error: "Not found" })
}
