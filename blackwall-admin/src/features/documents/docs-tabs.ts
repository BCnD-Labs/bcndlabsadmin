import { fileNameOf } from "./nextcloud-link.ts"

export interface OpenDoc { path: string; name: string }

/** Open a document: add its tab unless it is already open (then just switch to it). */
export function withDoc(docs: readonly OpenDoc[], path: string): OpenDoc[] {
  return docs.some((d) => d.path === path) ? [...docs] : [...docs, { path, name: fileNameOf(path) }]
}

/** Close a tab. If it was the one showing, show its neighbour (the next tab, or the last one), or nothing if none is left. */
export function afterClose(docs: readonly OpenDoc[], active: string | null, path: string): { docs: OpenDoc[]; active: string | null } {
  const index = docs.findIndex((d) => d.path === path)
  const rest = docs.filter((d) => d.path !== path)
  return { docs: rest, active: active === path ? (rest[Math.min(index, rest.length - 1)]?.path ?? null) : active }
}
