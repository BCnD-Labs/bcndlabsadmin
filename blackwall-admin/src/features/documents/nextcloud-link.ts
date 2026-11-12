/**
 * A linked document that lives in Nextcloud is stored as `nextcloud:/Folder/file.pptx` (the path inside
 * your Nextcloud, the same paths the Storage page uses). It is an ordinary link to the rest of the app;
 * the Mac app opens it in the built-in viewer instead of an outside program.
 */
export const NEXTCLOUD_SCHEME = "nextcloud:"

/** The link to store for a Nextcloud path, or null if the path isn't usable. */
export function nextcloudLink(path: string): string | null {
  const clean = cleanNextcloudPath(path)
  return clean && clean !== "/" ? NEXTCLOUD_SCHEME + clean : null
}

/** The Nextcloud path inside a `nextcloud:` link, or null for any other link (or one that tries to climb out of the root). */
export function nextcloudPathOf(url: string): string | null {
  const value = url.trim()
  if (value.slice(0, NEXTCLOUD_SCHEME.length).toLowerCase() !== NEXTCLOUD_SCHEME) return null
  const clean = cleanNextcloudPath(value.slice(NEXTCLOUD_SCHEME.length))
  return clean && clean !== "/" ? clean : null
}

function cleanNextcloudPath(raw: string): string | null {
  const parts: string[] = []
  for (const part of raw.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue
    if (part === ".." || /[\u0000-\u001f]/.test(part)) return null
    parts.push(part)
  }
  return "/" + parts.join("/")
}

export const fileNameOf = (path: string) => path.split("/").filter(Boolean).pop() ?? path
