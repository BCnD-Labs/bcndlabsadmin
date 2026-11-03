import { createServer } from "node:http"
import path from "node:path"
import { createApi } from "./app.ts"
import { Sessions } from "./auth.ts"
import { loadKey } from "./crypto.ts"
import { serveAppUpdates } from "./app-updates.ts"
import { serveStatic } from "./static.ts"
import { PostgresConnectionStore } from "./store-postgres.ts"
import { System } from "./system.ts"

/**
 * Home-server entry point: serves the built panel and the API, with
 * connections in Postgres (secrets encrypted) and a password login.
 * Configured entirely through environment variables; see deploy/.env.example.
 */
function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`[blackwall] ${name} is not set. See deploy/.env.example.`)
    process.exit(1)
  }
  return v
}

const key = loadKey(required("BLACKWALL_SECRET_KEY"))
const passwordHash = required("BLACKWALL_PASSWORD_HASH")
const store = new PostgresConnectionStore(required("DATABASE_URL"), key)
const port = Number(process.env.PORT ?? 8780)
const allowedHosts = (process.env.BLACKWALL_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)

const system = System.fromEnv(path.join(import.meta.dirname, ".."))

const appUpdatesDir = process.env.APP_UPDATES_DIR || undefined
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const appUpdates = serveAppUpdates(appUpdatesDir, (host) => LOOPBACK_HOST.test(host) || allowedHosts.includes(host))

const api = createApi({
  store,
  workspace: store,
  allowedHosts,
  auth: { passwordHash, sessions: new Sessions(key) },
  backupDir: process.env.BACKUP_DIR ?? "/backups",
  appUpdatesDir,
  health: async () => {
    await store.ping()
    return { database: "ok" }
  },
  system,
})
const files = serveStatic(process.env.DIST_DIR ?? path.join(import.meta.dirname, "..", "dist"))

// Retry while Postgres starts up alongside us.
for (let attempt = 1; ; attempt++) {
  try {
    await store.migrate()
    break
  } catch (e) {
    if (attempt >= 30) throw e
    console.log(`[blackwall] waiting for database (${(e as Error).message})`)
    await new Promise((r) => setTimeout(r, 2000))
  }
}

const server = createServer((req, res) => {
  const url = req.url ?? "/"
  if (url === "/healthz") {
    res.statusCode = 200
    return res.end("ok")
  }
  if (url.startsWith("/api/")) return void api(req, res)
  if (url.startsWith("/app-updates/")) return appUpdates(req, res)
  files(req, res)
})

server.listen(port, () => {
  console.log(`[blackwall] listening on :${port}; store ${store.where}; allowed hosts: ${allowedHosts.join(", ") || "(loopback only)"}`)
})

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    server.close()
    void store.close().finally(() => process.exit(0))
  })
}
