/**
 * Undo and redo for the site editor: snapshots taken before each change, kept only while the editor is open.
 * Typing in one field, or a burst of changes that came from one action, counts as one step.
 */
import type { Site, SiteBlock, SitePage } from "../src/lib/types.ts"

export interface SiteSnapshot { site: Site; pages: SitePage[] }

/** Changes this close together came from one action (a drag writes several pages at once). */
const SAME_ACTION_MS = 40
/** Edits to one text field this close together are one bit of typing. */
const SAME_TYPING_MS = 900
const LIMIT = 100

export class EditHistory<T> {
  private past: { snap: T; key: string; at: number }[] = []
  private future: T[] = []

  get canUndo() { return this.past.length > 0 }
  get canRedo() { return this.future.length > 0 }

  /** Call with the state from just before a change. An empty key never joins the step before it (except as one action). */
  record(before: T, key: string, now = Date.now()) {
    this.future = []
    const top = this.past.at(-1)
    if (top && (now - top.at < SAME_ACTION_MS || (key && key === top.key && now - top.at < SAME_TYPING_MS))) {
      top.at = now
      return
    }
    this.past.push({ snap: before, key, at: now })
    if (this.past.length > LIMIT) this.past.shift()
  }

  undo(current: T): T | undefined {
    const step = this.past.pop()
    if (step) this.future.push(current)
    return step?.snap
  }

  redo(current: T): T | undefined {
    const snap = this.future.pop()
    if (snap !== undefined) this.past.push({ snap: current, key: "", at: 0 })
    return snap
  }

  clear() {
    this.past = []
    this.future = []
  }
}

/** The bookkeeping fields: they change on their own and are never something to undo. */
const SITE_BOOKKEEPING = ["updatedAt", "publishedAt", "publishedSha", "exportedAt", "guideHidden"] as const

export function sameSite(a: Site, b: Site) {
  const bare = (s: Site) => { const c: Record<string, unknown> = { ...s }; for (const k of SITE_BOOKKEEPING) delete c[k]; return JSON.stringify(c) }
  return a === b || bare(a) === bare(b)
}

export function samePage(a: SitePage, b: SitePage) {
  if (a === b) return true
  const { updatedAt: _a, ...x } = a
  const { updatedAt: _b, ...y } = b
  return JSON.stringify(x) === JSON.stringify(y)
}

function flat(list: SiteBlock[], into = new Map<string, Record<string, unknown>>()) {
  for (const b of list) {
    const { kids, ...own } = b
    into.set(b.id, own)
    if (kids) flat(kids, into)
  }
  return into
}

/** What exactly changed between two blocks' trees, when it is one text field of one block. */
function typedField(a: SiteBlock[], b: SiteBlock[]): string | null {
  const x = flat(a), y = flat(b)
  if (x.size !== y.size) return null
  const changed: string[] = []
  for (const [id, own] of x) {
    const other = y.get(id)
    if (!other) return null
    for (const k of new Set([...Object.keys(own), ...Object.keys(other)])) {
      if (JSON.stringify(own[k]) === JSON.stringify(other[k])) continue
      if (typeof own[k] !== "string" || typeof other[k] !== "string") return null
      changed.push(`${id}.${k}`)
    }
  }
  return changed.length === 1 ? changed[0] : null
}

/**
 * A name for what changed: two changes with the same name, close together, are one undo step. Empty when
 * it was anything other than editing one field (moving, adding, removing, picking a style).
 */
export function changeKey(before: SiteSnapshot, after: SiteSnapshot): string {
  const siteFields = Object.keys({ ...before.site, ...after.site }).filter((k) => !(SITE_BOOKKEEPING as readonly string[]).includes(k) && JSON.stringify(before.site[k as keyof Site]) !== JSON.stringify(after.site[k as keyof Site]))
  const changed = after.pages.filter((p) => { const was = before.pages.find((x) => x.id === p.id); return !was || !samePage(was, p) })
  if (before.pages.length !== after.pages.length || changed.length > 1 || (changed.length && siteFields.length)) return ""
  if (siteFields.length) return `site:${siteFields.sort().join(",")}`
  const page = changed[0]
  if (!page) return ""
  const was = before.pages.find((x) => x.id === page.id)!
  const fields = Object.keys({ ...was, ...page }).filter((k) => k !== "updatedAt" && JSON.stringify(was[k as keyof SitePage]) !== JSON.stringify(page[k as keyof SitePage]))
  if (fields.length !== 1) return ""
  if (fields[0] === "sections") { const f = typedField(was.sections, page.sections); return f ? `page:${page.id}:${f}` : "" }
  return typeof page[fields[0] as keyof SitePage] === "string" ? `page:${page.id}:${fields[0]}` : ""
}
