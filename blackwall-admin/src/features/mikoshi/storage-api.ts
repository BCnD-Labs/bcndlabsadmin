import { api, ConnectorError } from "@/services/connector"

/** One file or folder from Nextcloud (see server/providers/nextcloud.ts). */
export interface StorageEntry {
  name: string
  path: string
  type: "file" | "dir"
  size: number
  modified: string
  mime?: string
  etag?: string
  fileId?: string
}

export interface StorageInfo {
  connected: boolean
  status?: string
  message?: string
  /** Nextcloud's address, for "Open in Nextcloud". */
  url?: string
  user?: string
}

export interface FolderListing {
  path: string
  entries: StorageEntry[]
  quota?: { used: number; free: number }
  self?: StorageEntry
}

const q = (path: string) => `path=${encodeURIComponent(path)}`

export const storage = {
  info: () => api<StorageInfo>("storage/info"),
  list: (path: string) => api<FolderListing>(`storage/list?${q(path)}`),
  readText: (path: string) => api<{ path: string; text: string; etag: string }>(`storage/text?${q(path)}`),
  writeText: (path: string, text: string, opts: { etag?: string; create?: boolean } = {}) =>
    api<{ path: string; etag: string }>("storage/text", { method: "PUT", body: JSON.stringify({ path, text, ...opts }) }),
  mkdir: (path: string) => api<{ path: string }>("storage/folder", { method: "POST", body: JSON.stringify({ path }) }),
  move: (from: string, to: string) => api<{ path: string }>("storage/move", { method: "POST", body: JSON.stringify({ from, to }) }),
  remove: (path: string) => api<{ path: string }>(`storage?${q(path)}`, { method: "DELETE" }),
}

/** Upload with progress (fetch can't report upload progress; XHR can). */
export function uploadFile(path: string, file: Blob, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", `/api/storage/upload?${q(path)}`)
    xhr.setRequestHeader("X-Blackwall", "1")
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let message = `HTTP ${xhr.status}`
      try {
        message = JSON.parse(xhr.responseText).error ?? message
      } catch {
        /* not JSON */
      }
      reject(new ConnectorError(message, xhr.status))
    }
    xhr.onerror = () => reject(new ConnectorError("Upload failed: the server isn't reachable", 0))
    xhr.send(file)
  })
}

/** Fetch a file's bytes (the API needs its header, so a plain link can't download it). */
export async function fetchFile(path: string): Promise<Blob> {
  const res = await fetch(`/api/storage/download?${q(path)}`, { headers: { "X-Blackwall": "1" } })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      message = (await res.json()).error ?? message
    } catch {
      /* not JSON */
    }
    throw new ConnectorError(message, res.status)
  }
  return res.blob()
}

export async function downloadFile(entry: StorageEntry) {
  const blob = await fetchFile(entry.path)
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement("a"), { href: url, download: entry.name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export const parentOf = (path: string) => path.split("/").slice(0, -1).join("/") || "/"
export const joinPath = (dir: string, name: string) => `${dir === "/" ? "" : dir}/${name}`

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}

/** Same rule as the server: text files up to 2 MB open in the editor. */
export const isTextFile = (e: Pick<StorageEntry, "name" | "mime">) =>
  /^text\//.test(e.mime ?? "") || /\.(md|markdown|txt|json|ya?ml|toml|ini|conf|cfg|env|csv|tsv|log|xml|html?|css|js|mjs|ts|tsx|jsx|py|sh|bash|zsh|rb|go|rs|java|c|h|cpp|sql|svg|caddyfile)$/i.test(e.name) || /^(dockerfile|caddyfile|makefile|readme)$/i.test(e.name)
export const isImage = (e: Pick<StorageEntry, "name" | "mime">) => /^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(e.mime ?? "") || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(e.name)
/** Word, Excel, PowerPoint and OpenDocument files open in Nextcloud's office app. */
export const isOffice = (e: Pick<StorageEntry, "name">) => /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(e.name)
