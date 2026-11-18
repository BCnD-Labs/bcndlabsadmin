export { canEditFile, extensionOf } from "../../../shared/storage.ts"

/** The Nextcloud path for a new document: the name is cleaned (no slashes or control characters) and gets the format's extension if it lacks it. Null when nothing usable is left. */
export function newDocumentPath(folder: string, name: string, extension: string): string | null {
  const clean = name.replace(/[\\/\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim()
  const noExt = clean.toLowerCase().endsWith("." + extension) ? clean.slice(0, -(extension.length + 1)) : clean
  const base = noExt.trim().replace(/^\.+/, "").trim()
  if (!base) return null
  return `${folder === "/" ? "" : folder.replace(/\/+$/, "")}/${base}.${extension}`
}
