import { createReadStream, readFileSync, statSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"

/**
 * App updates: a folder holding `android.json`, the newest build's manifest, and the .apk it
 * names. There are two ways to fill one: the server copies the newest Android build from GitHub
 * (app-updates-github.ts), or anything that can write the drop folder (APP_UPDATES_DIR, mounted
 * read-only: n8n, a person) publishes one by hand. The higher build number wins. The phone app
 * compares build numbers and downloads.
 *
 * Only the file the manifest names is ever served, so nothing else in the folder is reachable.
 * The manifest and the download are readable without signing in (they're app builds, and the
 * server is only published on the tailnet): a phone's browser can't send a session or the
 * X-Blackwall header, so the download lives at /app-updates/<file>, outside /api.
 */
export type UpdateManifest = { versionCode: number; versionName: string; file: string; sha256?: string; md5?: string; notes?: string }

export const APK_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.apk$/
/** `Blackwall-<version>-<arch>.dmg`, the name electron-builder gives the Mac installer. */
export const DMG_NAME = /^Blackwall-\d{1,4}\.\d{1,4}\.\d{1,4}-(?:arm64|x64)\.dmg$/

/** What differs between the phone's updates and the Mac app's: the manifest's name, the files it may name, how they're served. */
export interface UpdateKind {
  manifest: string
  file: RegExp
  contentType: string
}
export const ANDROID: UpdateKind = { manifest: "android.json", file: APK_NAME, contentType: "application/vnd.android.package-archive" }
/** The Mac app (Blackwall-<version>-arm64.dmg plus mac.json), published by desktop/scripts/publish.ts. */
export const MAC: UpdateKind = { manifest: "mac.json", file: DMG_NAME, contentType: "application/x-apple-diskimage" }

/** A folder, or a function that picks one per request (when updates can come from more than one place). */
export type UpdatesDir = string | undefined | (() => string | undefined)
const resolveDir = (dir: UpdatesDir) => (typeof dir === "function" ? dir() : dir)

export function parseUpdateManifest(value: unknown, kind: UpdateKind = ANDROID): UpdateManifest | null {
  if (!value || typeof value !== "object") return null
  const m = value as Record<string, unknown>
  if (typeof m.versionCode !== "number" || !Number.isInteger(m.versionCode) || m.versionCode < 1) return null
  if (typeof m.file !== "string" || !kind.file.test(m.file)) return null
  return {
    versionCode: m.versionCode,
    versionName: typeof m.versionName === "string" && m.versionName.length <= 40 ? m.versionName : String(m.versionCode),
    file: m.file,
    sha256: typeof m.sha256 === "string" && /^[0-9a-f]{64}$/i.test(m.sha256) ? m.sha256.toLowerCase() : undefined,
    md5: typeof m.md5 === "string" && /^[0-9a-f]{32}$/i.test(m.md5) ? m.md5.toLowerCase() : undefined,
    notes: typeof m.notes === "string" ? m.notes.slice(0, 500) : undefined,
  }
}

/** The current manifest, or null when the folder, file or JSON is missing or invalid. */
export function readUpdateManifest(source: UpdatesDir, kind: UpdateKind = ANDROID): UpdateManifest | null {
  const dir = resolveDir(source)
  if (!dir) return null
  try {
    return parseUpdateManifest(JSON.parse(readFileSync(path.join(dir, kind.manifest), "utf8")), kind)
  } catch {
    return null
  }
}

/** Of several update folders, the one whose manifest has the highest build number (undefined when none has one). */
export function newestUpdatesDir(dirs: (string | undefined)[], kind: UpdateKind = ANDROID): string | undefined {
  let best: { dir: string; code: number } | undefined
  for (const dir of dirs) {
    const code = readUpdateManifest(dir, kind)?.versionCode
    if (dir && code !== undefined && (!best || code > best.code)) best = { dir, code }
  }
  return best?.dir
}

/** GET /app-updates/<file>: streams the file the manifest names; 404 for anything else. */
export function serveAppUpdates(source: UpdatesDir, hostAllowed: (host: string) => boolean, kind: UpdateKind = ANDROID) {
  return function serve(req: IncomingMessage, res: ServerResponse) {
    const fail = (status: number) => {
      res.statusCode = status
      res.end()
    }
    if (!hostAllowed(req.headers.host ?? "")) return fail(403)
    if (req.method !== "GET" && req.method !== "HEAD") return fail(405)
    let name: string
    try {
      name = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname.replace(/^\/app-updates\//, ""))
    } catch {
      return fail(400)
    }
    const dir = resolveDir(source)
    const manifest = readUpdateManifest(dir, kind)
    if (!dir || !manifest || name !== manifest.file) return fail(404)
    const file = path.join(dir, manifest.file)
    let size: number
    try {
      const stat = statSync(file)
      if (!stat.isFile()) return fail(404)
      size = stat.size
    } catch {
      return fail(404)
    }
    res.statusCode = 200
    res.setHeader("Content-Type", kind.contentType)
    res.setHeader("Content-Length", String(size))
    res.setHeader("Content-Disposition", `attachment; filename="${manifest.file}"`)
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Cache-Control", "no-cache")
    if (req.method === "HEAD") return res.end()
    createReadStream(file).pipe(res)
  }
}
