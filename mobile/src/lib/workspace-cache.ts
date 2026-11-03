/**
 * What the phone keeps between launches, as one JSON text (see workspace-file-store.ts for where).
 *
 * - `baseline`: the last snapshot the server confirmed. It is the "base" of every later merge.
 * - `local` + `touched`: edits made here that the server has not accepted yet (the offline
 *   queue). Absent when nothing is waiting.
 * - `recovery`: the side the person discarded in the last conflict, so a choice never destroys data.
 *
 * Anything that doesn't validate is treated as "no cache"; it is never trusted and never thrown.
 */
import { validWorkspace, type Collections, type WorkspaceSnapshot } from "./shared.ts"
import { isCollectionKey, parseSnapshot } from "./workspace-http.ts"

export interface CacheFile {
  baseline: WorkspaceSnapshot
  local?: Collections
  touched?: (keyof Collections)[]
  recovery?: Collections
}

export function serializeCache(cache: CacheFile): string {
  return JSON.stringify({ v: 1, ...cache })
}

export function parseCache(text: string | null | undefined): CacheFile | null {
  if (!text) return null
  try {
    const raw = JSON.parse(text) as { v?: unknown; baseline?: unknown; local?: unknown; touched?: unknown; recovery?: unknown }
    if (!raw || raw.v !== 1) return null
    const baseline = parseSnapshot(raw.baseline)
    if (!baseline) return null
    const local = raw.local !== undefined && validWorkspace(raw.local) ? raw.local : undefined
    const recovery = raw.recovery !== undefined && validWorkspace(raw.recovery) ? raw.recovery : undefined
    const touched = Array.isArray(raw.touched) ? raw.touched.filter(isCollectionKey) : undefined
    return { baseline, local, touched, recovery }
  } catch {
    return null
  }
}
