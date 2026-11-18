import type { IncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"
import { ProviderError } from "./http.ts"
import { cleanPath, createForEditing, dav, davBase, editingInfo, listFolder, openForEditing } from "./providers/nextcloud.ts"
import type { ConnectionStore } from "./store.ts"

/** Files that open in the built-in editor: text, up to 2 MB. Everything else downloads or opens in Nextcloud. */
export const TEXT_LIMIT = 2 * 1024 * 1024
const UPLOAD_LIMIT = 1024 * 1024 * 1024
export const isTextFile = (name: string, mime?: string) =>
  /^text\//.test(mime ?? "") || /\.(md|markdown|txt|json|ya?ml|toml|ini|conf|cfg|env|csv|tsv|log|xml|html?|css|js|mjs|ts|tsx|jsx|py|sh|bash|zsh|rb|go|rs|java|c|h|cpp|sql|svg|caddyfile)$/i.test(name) || /^(dockerfile|caddyfile|makefile|readme)$/i.test(name)

type Json = (status: number, body: unknown) => void

/**
 * Mikoshi → Storage. Every call goes through the first working Nextcloud connection;
 * the browser never sees the app password. Deletes go to Nextcloud's trash bin.
 */
export async function handleStorage(store: ConnectionStore, req: IncomingMessage, res: ServerResponse, url: URL, sub: string, method: string, json: Json, readBody: <T>(limit?: number) => Promise<T>) {
  const c = await store.firstOk("nextcloud")
  if (sub === "info" && method === "GET") {
    if (!c) return json(200, { connected: false })
    const { url: base, user } = davBase(c)
    return json(200, { connected: c.status === "ok", status: c.status, message: c.message, url: base, user })
  }
  if (!c) throw new ProviderError("Nextcloud isn't connected. Add it in Settings → Connections.", 409)
  const path = () => cleanPath(url.searchParams.get("path") ?? "/")

  // Office editing: Nextcloud's Collabora editor, shown inside the Docs app (see docs/mikoshi/COLLABORA.md).
  if (sub === "edit/info" && method === "GET") return json(200, await editingInfo(c))
  if (sub === "edit/open" && method === "POST") {
    const p = cleanPath((await readBody<{ path?: string }>()).path)
    if (p === "/") throw new ProviderError("Pick a document to edit", 400)
    return json(200, { url: await openForEditing(c, p) })
  }
  if (sub === "edit/create" && method === "POST") {
    const body = await readBody<{ path?: string; extension?: string }>()
    const p = cleanPath(body.path)
    const creator = (await editingInfo(c)).creators.find((x) => x.extension === body.extension)
    if (!creator) throw new ProviderError("Nextcloud can't create that kind of document. Set up editing first.", 409)
    if (!p.toLowerCase().endsWith("." + creator.extension)) throw new ProviderError(`The name must end in .${creator.extension}`, 400)
    return json(200, { path: p, url: await createForEditing(c, p, creator) })
  }

  if (sub === "list" && method === "GET") return json(200, await listFolder(c, path()))

  if (sub === "text" && method === "GET") {
    const p = path()
    const r = await dav(c, "GET", p)
    const size = Number(r.headers.get("content-length") ?? 0)
    if (size > TEXT_LIMIT) throw new ProviderError("That file is too big to edit here (over 2 MB). Download it instead.", 413)
    const text = await r.text()
    if (text.length > TEXT_LIMIT) throw new ProviderError("That file is too big to edit here (over 2 MB). Download it instead.", 413)
    return json(200, { path: p, text, etag: (r.headers.get("oc-etag") ?? r.headers.get("etag") ?? "").replace(/"/g, "") })
  }
  if (sub === "text" && method === "PUT") {
    const body = await readBody<{ path?: string; text?: string; etag?: string; create?: boolean }>(TEXT_LIMIT + 64 * 1024)
    if (typeof body.text !== "string") throw new ProviderError("Missing text", 400)
    const p = cleanPath(body.path)
    const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" }
    if (body.create) headers["If-None-Match"] = "*"
    else if (body.etag) headers["If-Match"] = `"${body.etag}"`
    const r = await dav(c, "PUT", p, { headers, body: body.text }).catch((e) => {
      if (body.create && e instanceof ProviderError && e.status === 409) throw new ProviderError("A file with that name is already there", 409)
      throw e
    })
    return json(200, { path: p, etag: (r.headers.get("oc-etag") ?? r.headers.get("etag") ?? "").replace(/"/g, "") })
  }
  if (sub === "upload" && method === "PUT") {
    const p = path()
    const size = Number(req.headers["content-length"] ?? 0)
    if (!size) throw new ProviderError("Uploads need a size (Content-Length)", 411)
    if (size > UPLOAD_LIMIT) throw new ProviderError("Uploads here are limited to 1 GB; use Nextcloud for bigger files.", 413)
    await dav(c, "PUT", p, { headers: { "Content-Length": String(size), "Content-Type": String(req.headers["content-type"] ?? "application/octet-stream") }, body: req as unknown as RequestInit["body"], duplex: "half", timeout: 30 * 60_000 })
    return json(200, { path: p })
  }
  if (sub === "folder" && method === "POST") {
    const p = cleanPath((await readBody<{ path?: string }>()).path)
    await dav(c, "MKCOL", p).catch((e) => {
      throw e instanceof ProviderError && e.status === 405 ? new ProviderError("Something with that name is already there", 409) : e
    })
    return json(200, { path: p })
  }
  if (sub === "move" && method === "POST") {
    const body = await readBody<{ from?: string; to?: string }>()
    const from = cleanPath(body.from), to = cleanPath(body.to)
    if (from === "/" || to === "/") throw new ProviderError("Your root folder can't be moved", 400)
    if (to.startsWith(from + "/")) throw new ProviderError("A folder can't move inside itself", 400)
    const { root } = davBase(c)
    await dav(c, "MOVE", from, { headers: { Destination: root + to.split("/").map(encodeURIComponent).join("/"), Overwrite: "F" } }).catch((e) => {
      throw e instanceof ProviderError && e.status === 409 ? new ProviderError("Something with that name is already there", 409) : e
    })
    return json(200, { path: to })
  }
  if (sub === "" && method === "DELETE") {
    const p = path()
    if (p === "/") throw new ProviderError("Your root folder can't be deleted", 400)
    await dav(c, "DELETE", p)
    return json(200, { path: p })
  }
  if (sub === "download" && method === "GET") {
    const p = path()
    const r = await dav(c, "GET", p, { timeout: 30 * 60_000 })
    res.statusCode = 200
    res.setHeader("Content-Type", r.headers.get("content-type") ?? "application/octet-stream")
    const len = r.headers.get("content-length")
    if (len) res.setHeader("Content-Length", len)
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(p.split("/").at(-1) ?? "file")}`)
    res.setHeader("Cache-Control", "no-store")
    if (!r.body) return res.end()
    Readable.fromWeb(r.body as import("node:stream/web").ReadableStream).pipe(res)
    return
  }
  throw new ProviderError("Not found", 404)
}
