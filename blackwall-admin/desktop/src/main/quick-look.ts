import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

/**
 * Read-only previews through macOS Quick Look: Word, Excel, PowerPoint, PDF and friends open in
 * Apple's own viewer without Office installed. The file is written to a private temp folder first.
 */
export const PREVIEW_MAX_BYTES = 200 * 1024 * 1024
const PREVIEWABLE = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|pdf|pages|numbers|key|csv|txt|png|jpe?g|gif|heic|webp)$/i

/** A file name that is safe to write: no folders, no control characters, and one of the types Quick Look shows. */
export function previewName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const name = raw.replace(/\\/g, "/").split("/").pop()!.replace(/[\u0000-\u001f]/g, "").trim().replace(/^\.+/, "")
  if (!name || name.length > 200 || !PREVIEWABLE.test(name)) return null
  return name
}

/** Saves the bytes in a fresh folder under `root` and returns the file's path. */
export function writePreview(root: string, name: string, data: Uint8Array): string {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const dir = mkdtempSync(path.join(root, "p-"))
  const file = path.join(dir, name)
  writeFileSync(file, data, { mode: 0o600 })
  return file
}

/** Removes previews older than `maxAgeMs` (called at startup, so nothing lingers between launches). */
export function sweepPreviews(root: string, now = Date.now(), maxAgeMs = 60 * 60 * 1000) {
  let entries: string[]
  try { entries = readdirSync(root) } catch { return }
  for (const entry of entries) {
    const dir = path.join(root, entry)
    try { if (now - statSync(dir).mtimeMs > maxAgeMs) rmSync(dir, { recursive: true, force: true }) } catch { /* leave it */ }
  }
}
