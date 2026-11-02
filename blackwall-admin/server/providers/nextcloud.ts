import type { StoredConnection } from "../store.ts"
import { ProviderError, fmtCount, need } from "../http.ts"
import type { TestResult } from "./index.ts"

/**
 * Nextcloud files over WebDAV, Nextcloud's standard file API, with an app password
 * (Personal settings → Security → Devices & sessions). Paths are always relative
 * to the user's root and are normalised so they can't climb out of it.
 */
export interface StorageEntry {
  name: string
  /** "/Documents/notes.md" (directories end without a slash). */
  path: string
  type: "file" | "dir"
  size: number
  modified: string
  mime?: string
  etag?: string
  /** Nextcloud's file id, for the /f/<id> link that opens it in Nextcloud. */
  fileId?: string
}

export function cleanPath(raw: unknown): string {
  if (typeof raw !== "string") throw new ProviderError("Missing path", 400)
  const parts: string[] = []
  for (const seg of raw.replace(/\\/g, "/").split("/")) {
    if (!seg || seg === ".") continue
    if (seg === "..") throw new ProviderError("Paths can't go above your Nextcloud root", 400)
    if (/[\u0000-\u001f]/.test(seg)) throw new ProviderError("That name has control characters", 400)
    parts.push(seg)
  }
  return "/" + parts.join("/")
}

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/")

export function davBase(c: StoredConnection) {
  const url = need(c.config.url, "Nextcloud address").replace(/\/+$/, "")
  const user = need(c.config.username, "Username")
  const pass = need(c.secrets.appPassword, "App password")
  return { url, user, root: `${url}/remote.php/dav/files/${encodeURIComponent(user)}`, auth: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` }
}

export async function dav(c: StoredConnection, method: string, path: string, init: { headers?: Record<string, string>; body?: RequestInit["body"]; timeout?: number; duplex?: "half" } = {}) {
  const b = davBase(c)
  let res: Response
  try {
    res = await fetch(b.root + enc(path), { method, body: init.body, headers: { Authorization: b.auth, ...init.headers }, signal: AbortSignal.timeout(init.timeout ?? 30_000), ...(init.duplex ? { duplex: init.duplex } : {}) } as RequestInit)
  } catch (e) {
    throw new ProviderError(`Nextcloud isn't reachable: ${(e as Error).message}`)
  }
  if (res.status === 401) throw new ProviderError("Nextcloud rejected the app password. Create a new one in Personal settings → Security.", 401)
  if (res.status === 404) throw new ProviderError("That file or folder doesn't exist anymore", 404)
  if (res.status === 412) throw new ProviderError("The file changed in Nextcloud since you opened it. Reload it before saving.", 409)
  if (res.status === 507) throw new ProviderError("Nextcloud is out of space (quota reached)", 507)
  if (!res.ok && res.status !== 207) throw new ProviderError(`Nextcloud answered HTTP ${res.status}`, res.status >= 500 ? 502 : res.status)
  return res
}

const PROPS = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop><d:getlastmodified/><d:getcontentlength/><d:getcontenttype/><d:resourcetype/><d:getetag/><oc:fileid/><oc:size/><d:quota-used-bytes/><d:quota-available-bytes/></d:prop>
</d:propfind>`

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i"))
  return m?.[1]?.trim()
}
const decodeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")

/** Parse a PROPFIND multistatus into entries (namespace prefixes vary by server). */
export function parseMultistatus(xml: string, rootPath: string): { entries: StorageEntry[]; quota?: { used: number; free: number } } {
  const blocks = xml.match(/<(?:[\w-]+:)?response(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?response>/gi) ?? []
  const entries: StorageEntry[] = []
  let quota: { used: number; free: number } | undefined
  for (const block of blocks) {
    const href = decodeURIComponent(decodeXml(tag(block, "href") ?? ""))
    const i = href.indexOf(rootPath)
    if (i < 0) continue
    const rel = href.slice(i + rootPath.length).replace(/\/+$/, "") || "/"
    const dir = /<(?:[\w-]+:)?collection\s*\/?>/i.test(tag(block, "resourcetype") ?? "")
    const size = Number(tag(block, "getcontentlength") ?? tag(block, "size") ?? 0) || 0
    if (rel === "/") {
      const used = Number(tag(block, "quota-used-bytes")), free = Number(tag(block, "quota-available-bytes"))
      if (Number.isFinite(used) && Number.isFinite(free)) quota = { used, free }
    }
    entries.push({
      name: rel === "/" ? "" : rel.split("/").at(-1)!,
      path: rel,
      type: dir ? "dir" : "file",
      size: dir ? Number(tag(block, "size") ?? 0) || 0 : size,
      modified: new Date(tag(block, "getlastmodified") ?? 0).toISOString(),
      mime: dir ? undefined : tag(block, "getcontenttype"),
      etag: tag(block, "getetag")?.replace(/&quot;|"/g, ""),
      fileId: tag(block, "fileid"),
    })
  }
  return { entries, quota }
}

export async function listFolder(c: StoredConnection, path: string) {
  const res = await dav(c, "PROPFIND", path, { headers: { Depth: "1", "Content-Type": "application/xml" }, body: PROPS })
  const { user } = davBase(c)
  const { entries, quota } = parseMultistatus(await res.text(), `/remote.php/dav/files/${user}`)
  const self = entries.find((e) => e.path === path)
  return { path, entries: entries.filter((e) => e.path !== path).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === "dir" ? -1 : 1)), quota, self }
}

export async function testNextcloud(c: StoredConnection): Promise<TestResult> {
  const { user, url } = davBase(c)
  const { entries, quota } = await listFolder(c, "/")
  const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`
  return {
    status: "ok",
    account: `${user} on ${url.replace(/^https?:\/\//, "")}`,
    summary: [
      { label: "Top-level items", value: fmtCount(entries.length) },
      ...(quota ? [{ label: "Used", value: quota.free >= 0 ? `${gb(quota.used)} of ${gb(quota.used + quota.free)}` : gb(quota.used) }] : []),
    ],
  }
}
