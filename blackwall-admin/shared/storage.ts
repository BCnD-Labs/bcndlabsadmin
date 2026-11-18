/**
 * Nextcloud storage shapes and small rules used by the server, the web app and the Android app
 * (server/storage.ts and server/providers/nextcloud.ts produce these).
 */

/** One file or folder. Paths are relative to the user's root ("/Documents/notes.md"; folders end without a slash). */
export interface StorageEntry {
  name: string
  path: string
  type: "file" | "dir"
  size: number
  modified: string
  mime?: string
  etag?: string
  /** Nextcloud's file id, for the /f/<id> link that opens it in Nextcloud. */
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

/** Text files up to this size open in the built-in editor or viewer. */
export const TEXT_LIMIT = 2 * 1024 * 1024

export const isTextFile = (e: Pick<StorageEntry, "name" | "mime">) =>
  /^text\//.test(e.mime ?? "") || /\.(md|markdown|txt|json|ya?ml|toml|ini|conf|cfg|env|csv|tsv|log|xml|html?|css|js|mjs|ts|tsx|jsx|py|sh|bash|zsh|rb|go|rs|java|c|h|cpp|sql|svg|caddyfile)$/i.test(e.name) || /^(dockerfile|caddyfile|makefile|readme)$/i.test(e.name)

/** Word, Excel, PowerPoint and OpenDocument files open in Nextcloud's office app. */
export const isOffice = (e: Pick<StorageEntry, "name">) => /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(e.name)

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
