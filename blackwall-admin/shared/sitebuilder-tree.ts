/**
 * The site editor's moves, as pure functions: blocks in a page's tree and pages in the site's menu.
 * Dragging, Alt+arrow keys and the inspector all go through these, so the rules live in one place.
 */
import { BLOCKS, cloneBlocks } from "./sitebuilder.ts"
import type { SiteBlock, SitePage } from "../src/lib/types.ts"

export function findBlock(list: SiteBlock[], id: string): SiteBlock | undefined {
  for (const b of list) {
    if (b.id === id) return b
    const below = b.kids && findBlock(b.kids, id)
    if (below) return below
  }
  return undefined
}

/** The ids from a top-level section down to a block. */
export function pathTo(list: SiteBlock[], id: string): string[] | null {
  for (const b of list) {
    if (b.id === id) return [b.id]
    const below = b.kids ? pathTo(b.kids, id) : null
    if (below) return [b.id, ...below]
  }
  return null
}

/** Replaces (or, with null, removes) one block anywhere in the tree. */
export function mapTree(list: SiteBlock[], id: string, fn: (b: SiteBlock) => SiteBlock | null): SiteBlock[] {
  return list.flatMap((b) => {
    if (b.id === id) {
      const r = fn(b)
      return r ? [r] : []
    }
    return [b.kids ? { ...b, kids: mapTree(b.kids, id, fn) } : b]
  })
}

/** Whether a block may sit directly inside a parent (null is the page itself): sections only at the top, everything else inside a container, a row never straight inside a row. */
export function canHold(parent: Pick<SiteBlock, "type"> | null, child: Pick<SiteBlock, "type">): boolean {
  if (child.type === "section") return parent === null
  if (!parent || !BLOCKS[parent.type]?.container) return false
  return parent.type !== child.type
}

function insertAt(list: SiteBlock[], parentId: string | null, beforeId: string | null, block: SiteBlock): SiteBlock[] {
  const place = (sibs: SiteBlock[]) => {
    const at = beforeId ? sibs.findIndex((b) => b.id === beforeId) : -1
    return at < 0 ? [...sibs, block] : [...sibs.slice(0, at), block, ...sibs.slice(at)]
  }
  return parentId === null ? place(list) : mapTree(list, parentId, (p) => ({ ...p, kids: place(p.kids ?? []) }))
}

/** Moves a block to sit inside `parentId` (null: top level), before `beforeId` (null: last). An illegal move changes nothing. */
export function moveBlock(list: SiteBlock[], id: string, parentId: string | null, beforeId: string | null): SiteBlock[] {
  const block = findBlock(list, id)
  if (!block || id === parentId || id === beforeId || (parentId && pathTo(block.kids ?? [], parentId))) return list
  const parent = parentId ? findBlock(list, parentId) : null
  if (parentId && !parent) return list
  if (!canHold(parent ?? null, block)) return list
  return insertAt(mapTree(list, id, () => null), parentId, beforeId, block)
}

function siblingsOf(list: SiteBlock[], id: string): { parentId: string | null; sibs: SiteBlock[] } | null {
  if (list.some((b) => b.id === id)) return { parentId: null, sibs: list }
  const path = pathTo(list, id)
  if (!path || path.length < 2) return null
  const parentId = path[path.length - 2]
  return { parentId, sibs: findBlock(list, parentId)?.kids ?? [] }
}

/** Alt+Up / Alt+Down: one place earlier or later among its siblings. */
export function nudgeBlock(list: SiteBlock[], id: string, d: -1 | 1): SiteBlock[] {
  const here = siblingsOf(list, id)
  if (!here) return list
  const i = here.sibs.findIndex((b) => b.id === id), j = i + d
  if (j < 0 || j >= here.sibs.length) return list
  return moveBlock(list, id, here.parentId, d < 0 ? here.sibs[j].id : here.sibs[j + 1]?.id ?? null)
}

/** Alt+Left: out of its container, to just after it. */
export function outdentBlock(list: SiteBlock[], id: string): SiteBlock[] {
  const here = siblingsOf(list, id)
  if (!here?.parentId) return list
  const up = siblingsOf(list, here.parentId)
  if (!up) return list
  return moveBlock(list, id, up.parentId, up.sibs[up.sibs.findIndex((b) => b.id === here.parentId) + 1]?.id ?? null)
}

/** Alt+Right: into the container just before it, as its last block. */
export function indentBlock(list: SiteBlock[], id: string): SiteBlock[] {
  const here = siblingsOf(list, id)
  if (!here) return list
  const before = here.sibs[here.sibs.findIndex((b) => b.id === id) - 1]
  return before ? moveBlock(list, id, before.id, null) : list
}

/** A copy of a block (with fresh ids) right after it. */
export function duplicateBlock(list: SiteBlock[], id: string): { list: SiteBlock[]; copyId: string | null } {
  const block = findBlock(list, id), here = siblingsOf(list, id)
  if (!block || !here) return { list, copyId: null }
  const [copy] = cloneBlocks([block])
  const after = here.sibs[here.sibs.findIndex((b) => b.id === id) + 1]?.id ?? null
  return { list: insertAt(list, here.parentId, after, copy), copyId: copy.id }
}

/* ---------------------------------------------------------- pages and menus */

/** The site's pages as the editor lists them: in menu order, each with the pages nested under it. */
export function pageTree(pages: readonly SitePage[]): { page: SitePage; kids: SitePage[] }[] {
  const sorted = [...pages].sort((a, b) => a.order - b.order)
  const roots = sorted.filter((p) => !p.parentId || !sorted.some((x) => x.id === p.parentId && !x.parentId))
  return roots.map((page) => ({ page, kids: sorted.filter((k) => k.parentId === page.id && !roots.includes(k)) }))
}

/** Only ordinary top-level pages can nest: not the home page, and not a page that has a drop-down of its own. */
export function canNest(page: SitePage, pages: readonly SitePage[]) {
  return !!page.slug && !pages.some((p) => p.parentId === page.id)
}

export interface PagePatch { id: string; order: number; parentId?: string }

/** Moves a page under `parentId` (null: top level), before `beforeId` (null: last). Returns only the pages whose place changed. */
export function movePage(pages: readonly SitePage[], id: string, parentId: string | null, beforeId: string | null): PagePatch[] {
  const page = pages.find((p) => p.id === id)
  if (!page || id === parentId || id === beforeId) return []
  if (parentId && (!canNest(page, pages) || !pageTree(pages).some((r) => r.page.id === parentId))) return []
  const tree = pageTree(pages).map((r) => ({ ...r, kids: r.kids.filter((k) => k.id !== id) }))
  const moving = tree.find((r) => r.page.id === id)
  const rest = tree.filter((r) => r.page.id !== id)
  const placed: SitePage = parentId ? { ...page, parentId } : { ...page, parentId: undefined }
  const into = <T extends { id: string }>(sibs: T[], item: T) => {
    const at = beforeId ? sibs.findIndex((s) => s.id === beforeId) : -1
    return at < 0 ? [...sibs, item] : [...sibs.slice(0, at), item, ...sibs.slice(at)]
  }
  let final: { page: SitePage; kids: SitePage[] }[]
  if (parentId) final = rest.map((r) => (r.page.id === parentId ? { ...r, kids: into(r.kids, placed) } : r))
  else {
    const item = { id, page: placed, kids: moving?.kids ?? [] }
    final = into(rest.map((r) => ({ ...r, id: r.page.id })), item)
  }
  const out: PagePatch[] = []
  let order = 0
  const note = (p: SitePage, parent: string | undefined) => {
    const was = pages.find((x) => x.id === p.id)
    if (was && (was.order !== order || (was.parentId || undefined) !== parent)) out.push({ id: p.id, order, parentId: parent })
    order++
  }
  for (const r of final) {
    note(r.page, undefined)
    for (const k of r.kids) note(k, r.page.id)
  }
  return out
}

/* ------------------------------------------------------------ tree dragging */

export interface TreeRow { id: string; depth: number; parentId: string | null }
export interface TreeDrop { depth: number; parentId: string | null; beforeId: string | null }

/**
 * Where a dragged row would land: `rows` is the visible list without the dragged row's own descendants, `overId` the row it is over,
 * `offsetX` how far it has been pulled sideways. Pulling right nests, pulling left un-nests. Takes the legal depth nearest the
 * pull, or null when nowhere nearby is legal.
 */
export function projectDrop<R extends TreeRow>(rows: readonly R[], activeId: string, overId: string, offsetX: number, indent: number, canDrop: (active: R, parent: R | null) => boolean): TreeDrop | null {
  const from = rows.findIndex((r) => r.id === activeId), to = rows.findIndex((r) => r.id === overId)
  if (from < 0 || to < 0) return null
  const active = rows[from]
  const moved = [...rows]
  moved.splice(to, 0, moved.splice(from, 1)[0])
  const prev = moved[to - 1], next = moved[to + 1]
  const max = prev ? prev.depth + 1 : 0, min = next ? next.depth : 0
  const wanted = Math.min(max, Math.max(min, active.depth + Math.round(offsetX / indent)))
  const parentAt = (depth: number): R | null => {
    if (depth === 0) return null
    for (let i = to - 1; i >= 0; i--) if (moved[i].depth === depth - 1) return moved[i]
    return null
  }
  const depths = Array.from({ length: max - min + 1 }, (_, i) => min + i).sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b)
  for (const depth of depths) {
    const parent = parentAt(depth)
    if (depth > 0 && !parent) continue
    if (!canDrop(active, parent)) continue
    let beforeId: string | null = null
    for (let i = to + 1; i < moved.length; i++) {
      if (moved[i].depth < depth) break
      if (moved[i].depth === depth) { beforeId = moved[i].id; break }
    }
    return { depth, parentId: parent?.id ?? null, beforeId }
  }
  return null
}
