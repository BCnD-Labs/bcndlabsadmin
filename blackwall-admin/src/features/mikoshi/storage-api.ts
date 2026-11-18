import { api, ConnectorError } from "@/services/connector"

import type { FolderListing, StorageEntry, StorageInfo } from "@shared/storage"
export type { FolderListing, StorageEntry, StorageInfo }
export { formatSize, isOffice, isTextFile, joinPath, parentOf } from "@shared/storage"

/** What Nextcloud's office editor (Collabora) can open and create. `available` is false until it is set up (docs/mikoshi/COLLABORA.md). */
export interface EditingInfo {
  available: boolean
  extensions: string[]
  creators: { id: string; editor: string; name: string; extension: string }[]
}

const q = (path: string) => `path=${encodeURIComponent(path)}`

export const storage = {
  info: () => api<StorageInfo>("storage/info"),
  list: (path: string) => api<FolderListing>(`storage/list?${q(path)}`),
  readText: (path: string) => api<{ path: string; text: string; etag: string }>(`storage/text?${q(path)}`),
  writeText: (path: string, text: string, opts: { etag?: string; create?: boolean } = {}) =>
    api<{ path: string; etag: string }>("storage/text", { method: "PUT", body: JSON.stringify({ path, text, ...opts }) }),
  editInfo: () => api<EditingInfo>("storage/edit/info"),
  /** A one-time address for the editor page; ask just before showing it. */
  editOpen: (path: string) => api<{ url: string }>("storage/edit/open", { method: "POST", body: JSON.stringify({ path }) }),
  editCreate: (path: string, extension: string) => api<{ path: string; url: string }>("storage/edit/create", { method: "POST", body: JSON.stringify({ path, extension }) }),
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

export const isImage = (e: Pick<StorageEntry, "name" | "mime">) => /^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(e.mime ?? "") || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(e.name)
