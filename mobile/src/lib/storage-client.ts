import { isTextFile, TEXT_LIMIT, type FolderListing, type StorageEntry, type StorageInfo } from "./shared.ts"

/**
 * Nextcloud files through your Blackwall server (blackwall-admin/server/storage.ts): `GET /api/storage/info`,
 * `/list?path=` and `/text?path=`. Same rules as workspace-http: `X-Blackwall: 1`, the shared sign-in cookie,
 * a timeout, and fixed short messages (nothing from the response is copied into them). Pure apart from the
 * injected fetch, so it runs under node --test. The phone never talks to Nextcloud itself.
 */
export const STORAGE_TIMEOUT_MS = 15_000

export type StorageResult<T> = { ok: true; value: T } | { ok: false; kind: "signed-out" | "not-connected" | "error"; message: string }

const MESSAGES = {
  unreachable: "Couldn't reach the server. Check the connection (is Tailscale on?) and pull down to try again.",
  signedOut: "Sign in under Settings to see your files.",
  notConnected: "Nextcloud isn't connected. Connect it in Web view under Settings → Connections.",
  tooBig: "That file is too big to show here (over 2 MB).",
  missing: "That file or folder isn't there any more.",
  shape: "The server's answer wasn't in a form the app understands.",
}

export const storageUrl = (address: string, sub: "info" | "list" | "text", path?: string): string =>
  `${address.replace(/\/+$/, "")}/api/storage/${sub}${path === undefined ? "" : `?path=${encodeURIComponent(path)}`}`

async function getJson(url: string, fetchImpl: typeof fetch): Promise<StorageResult<unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetchImpl(url, { method: "GET", signal: controller.signal, credentials: "include", headers: { Accept: "application/json", "X-Blackwall": "1" } })
    } catch {
      return { ok: false, kind: "error", message: MESSAGES.unreachable }
    }
    if (res.status === 401) return { ok: false, kind: "signed-out", message: MESSAGES.signedOut }
    if (res.status === 409) return { ok: false, kind: "not-connected", message: MESSAGES.notConnected }
    if (res.status === 413) return { ok: false, kind: "error", message: MESSAGES.tooBig }
    if (res.status === 404) return { ok: false, kind: "error", message: MESSAGES.missing }
    if (!res.ok) return { ok: false, kind: "error", message: `The server answered ${res.status}.` }
    try {
      return { ok: true, value: await res.json() }
    } catch {
      return { ok: false, kind: "error", message: MESSAGES.shape }
    }
  } finally {
    clearTimeout(timer)
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

export function parseEntry(v: unknown): StorageEntry | null {
  if (!isRecord(v) || typeof v.name !== "string" || typeof v.path !== "string" || (v.type !== "file" && v.type !== "dir") || typeof v.size !== "number" || typeof v.modified !== "string") return null
  return {
    name: v.name, path: v.path, type: v.type, size: v.size, modified: v.modified,
    mime: typeof v.mime === "string" ? v.mime : undefined,
    fileId: typeof v.fileId === "string" ? v.fileId : undefined,
  }
}

export function parseListing(v: unknown): FolderListing | null {
  if (!isRecord(v) || typeof v.path !== "string" || !Array.isArray(v.entries)) return null
  const entries: StorageEntry[] = []
  for (const raw of v.entries) {
    const e = parseEntry(raw)
    if (!e) return null
    entries.push(e)
  }
  const q = isRecord(v.quota) && typeof v.quota.used === "number" && typeof v.quota.free === "number" ? { used: v.quota.used, free: v.quota.free } : undefined
  return { path: v.path, entries, quota: q }
}

export function parseInfo(v: unknown): StorageInfo | null {
  if (!isRecord(v) || typeof v.connected !== "boolean") return null
  return { connected: v.connected, status: typeof v.status === "string" ? v.status : undefined, url: typeof v.url === "string" ? v.url : undefined, user: typeof v.user === "string" ? v.user : undefined }
}

function shaped<T>(r: StorageResult<unknown>, parse: (v: unknown) => T | null): StorageResult<T> {
  if (!r.ok) return r
  const value = parse(r.value)
  return value ? { ok: true, value } : { ok: false, kind: "error", message: MESSAGES.shape }
}

export const fetchStorageInfo = async (address: string, fetchImpl: typeof fetch = fetch) => shaped(await getJson(storageUrl(address, "info"), fetchImpl), parseInfo)
export const fetchFolder = async (address: string, path: string, fetchImpl: typeof fetch = fetch) => shaped(await getJson(storageUrl(address, "list", path), fetchImpl), parseListing)
export const fetchText = async (address: string, path: string, fetchImpl: typeof fetch = fetch) =>
  shaped(await getJson(storageUrl(address, "text", path), fetchImpl), (v) => (isRecord(v) && typeof v.text === "string" ? v.text : null))

/** "Documents › Work" style crumbs for a path, root first. */
export function crumbs(path: string): { label: string; path: string }[] {
  const parts = path.split("/").filter(Boolean)
  return [{ label: "Files", path: "/" }, ...parts.map((label, i) => ({ label, path: `/${parts.slice(0, i + 1).join("/")}` }))]
}

/** Nextcloud's own page for a file (its /f/<id> link), when the server told us both the address and the id. Web addresses only. */
export function nextcloudLink(info: StorageInfo | null, entry: StorageEntry): string | null {
  if (!info?.url || !entry.fileId || !/^https?:\/\//i.test(info.url)) return null
  return `${info.url.replace(/\/+$/, "")}/f/${encodeURIComponent(entry.fileId)}`
}

/** What opening an entry does on the phone: browse a folder, show text, hand it to Nextcloud, or nothing to offer yet. */
export type FileAction = "folder" | "text" | "nextcloud" | "none"

export function fileAction(entry: StorageEntry, info: StorageInfo | null): FileAction {
  if (entry.type === "dir") return "folder"
  if (isTextFile(entry) && entry.size <= TEXT_LIMIT) return "text"
  return nextcloudLink(info, entry) ? "nextcloud" : "none"
}

/** Long text is cut for the phone viewer so a 2 MB log doesn't stall it. */
export const VIEW_LIMIT = 200_000
export function viewText(text: string): { text: string; cut: boolean } {
  return text.length > VIEW_LIMIT ? { text: text.slice(0, VIEW_LIMIT), cut: true } : { text, cut: false }
}

/** "Used 12 GB of 100 GB", or just the used amount when Nextcloud reports no limit (free < 0). */
export function quotaLine(quota: FolderListing["quota"], format: (n: number) => string): string | null {
  if (!quota) return null
  return quota.free >= 0 ? `Used ${format(quota.used)} of ${format(quota.used + quota.free)}` : `Used ${format(quota.used)}`
}
