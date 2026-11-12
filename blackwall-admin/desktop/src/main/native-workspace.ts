import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { net, type Session } from "electron"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { MacUpdater } from "./updater.ts"
import type { SourceUpdater } from "./source-updater.ts"
import { PREVIEW_MAX_BYTES, previewName } from "./quick-look.ts"

export const NATIVE_HOME = "bw-native://app/"
const NATIVE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "native")

/** The renderer only sees the bundled UI; requests for data go to the configured server. */
export interface WorkspaceShell {
  /** Opens a browser tab (the workspace has no browser chrome of its own). */
  openBrowser(): void
  /** Shows a downloaded document in macOS Quick Look (read-only). */
  previewFile(name: string, data: Uint8Array): void
}

export function registerNativeWorkspace(ses: Session, serverAddress: () => string | null, updater?: MacUpdater, sourceUpdater?: SourceUpdater, shell?: WorkspaceShell) {
  ses.protocol.handle("bw-native", async (request) => {
    const url = new URL(request.url)
    if (url.host !== "app") return new Response("Not found", { status: 404 })

    if (url.pathname === "/__mac/shell/browser") {
      if (!shell || request.method !== "POST" || request.headers.get("x-blackwall") !== "1") return new Response("Not found", { status: 404 })
      shell.openBrowser()
      return Response.json({ ok: true })
    }

    if (url.pathname === "/__mac/shell/preview") {
      if (!shell || request.method !== "POST" || request.headers.get("x-blackwall") !== "1") return new Response("Not found", { status: 404 })
      const name = previewName(url.searchParams.get("name"))
      if (!name) return Response.json({ error: "That kind of file can't be previewed here." }, { status: 415 })
      const data = new Uint8Array(await request.arrayBuffer())
      if (data.byteLength === 0 || data.byteLength > PREVIEW_MAX_BYTES) return Response.json({ error: "That file is empty or too large to preview." }, { status: 413 })
      shell.previewFile(name, data)
      return Response.json({ ok: true })
    }

    // The app's own updater (Settings → About). Other pages can't reach this scheme (no CORS), and the
    // custom header keeps it that way even if that changed.
    if (url.pathname.startsWith("/__mac/update/")) {
      if (!updater || request.headers.get("x-blackwall") !== "1") return new Response("Not found", { status: 404 })
      const action = url.pathname.slice("/__mac/update/".length)
      if (action === "status" && request.method === "GET") return Response.json(updater.current())
      if (action === "check" && request.method === "POST") return Response.json(await updater.check())
      if (action === "install" && request.method === "POST") {
        void updater.install() // runs on; the page polls /status for progress
        return Response.json(updater.current())
      }
      // Update from source (a local rebuild instead of a published release).
      if (sourceUpdater && action === "source" && request.method === "GET") return Response.json(sourceUpdater.current())
      if (sourceUpdater && action === "source/start" && request.method === "POST") return Response.json(sourceUpdater.start())
      if (sourceUpdater && action === "source/dismiss" && request.method === "POST") return Response.json(sourceUpdater.dismiss())
      return new Response("Not found", { status: 404 })
    }

    if (url.pathname.startsWith("/api/")) {
      const server = serverAddress()
      if (!server) return Response.json({ error: "Set your Blackwall server address in the Mac app menu." }, { status: 503 })
      const target = new URL(url.pathname + url.search, server)
      const headers = new Headers()
      for (const name of ["accept", "content-type", "range", "x-blackwall"]) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
      }
      headers.set("X-Blackwall", "1")
      try {
        return await ses.fetch(target.href, {
          method: request.method,
          headers,
          body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
          credentials: "include",
          redirect: "follow",
        })
      } catch {
        return Response.json({ error: "The Blackwall server is unreachable." }, { status: 503 })
      }
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response("Not found", { status: 404 })
    }
    const filename = path.resolve(NATIVE_ROOT, `.${pathname}`)
    if (filename !== NATIVE_ROOT && !filename.startsWith(NATIVE_ROOT + path.sep)) return new Response("Not found", { status: 404 })
    const isFile = existsSync(filename) && statSync(filename).isFile()
    if (!isFile && path.extname(filename)) return new Response("Not found", { status: 404 })
    const file = isFile ? filename : path.join(NATIVE_ROOT, "index.html")
    return net.fetch(pathToFileURL(file).href)
  })
}
