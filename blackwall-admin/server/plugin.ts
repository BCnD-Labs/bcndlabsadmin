import type { Connect, Plugin } from "vite"
import { createApi } from "./app.ts"
import { FileConnectionStore } from "./store.ts"

/**
 * Development: mounts the API on the Vite dev and preview servers, backed by
 * `.blackwall/connections.json`. Loopback only, no login. The home server runs
 * the same API through server/main.ts with Postgres and a login.
 */
export function blackwallConnector(root: string): Plugin {
  let handle: ReturnType<typeof createApi> | undefined
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/")) return next()
    handle ??= createApi({ store: new FileConnectionStore(root) })
    void handle(req, res)
  }
  return {
    name: "blackwall-connector",
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}
