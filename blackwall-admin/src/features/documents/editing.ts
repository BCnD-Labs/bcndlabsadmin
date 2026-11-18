import type { EditingInfo } from "@/features/mikoshi/storage-api"

export const extensionOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? ""

/** Whether Nextcloud's office editor (Collabora) is set up and can open this file. */
export const canEditFile = (info: Pick<EditingInfo, "available" | "extensions"> | null, name: string) => !!info?.available && info.extensions.includes(extensionOf(name))

/** The Nextcloud path for a new document: the name is cleaned (no slashes or control characters) and gets the format's extension if it lacks it. Null when nothing usable is left. */
export function newDocumentPath(folder: string, name: string, extension: string): string | null {
  const clean = name.replace(/[\\/\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim()
  const noExt = clean.toLowerCase().endsWith("." + extension) ? clean.slice(0, -(extension.length + 1)) : clean
  const base = noExt.trim().replace(/^\.+/, "").trim()
  if (!base) return null
  return `${folder === "/" ? "" : folder.replace(/\/+$/, "")}/${base}.${extension}`
}
