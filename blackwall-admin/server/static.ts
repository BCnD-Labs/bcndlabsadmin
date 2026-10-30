import { createReadStream, existsSync, statSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
}

/** Serves the built panel (dist/) with an SPA fallback to index.html. */
export function serveStatic(distDir: string) {
  const root = path.resolve(distDir)
  return function serve(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405
      return res.end()
    }
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)
    let file = path.resolve(root, `.${pathname}`)
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.statusCode = 400
      return res.end()
    }
    const isAsset = existsSync(file) && statSync(file).isFile()
    if (!isAsset) file = path.join(root, "index.html") // client-side route

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
    res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream")
    // Hashed build assets never change; index.html must always be fresh.
    res.setHeader("Cache-Control", isAsset && pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache")
    if (req.method === "HEAD") return res.end()
    createReadStream(file).pipe(res)
  }
}
