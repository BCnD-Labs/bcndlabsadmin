/**
 * Linked records (`recordLinks`: a note, another task, or a day's log): which ones can be linked,
 * how a link reads, and adding/removing within the shared limit. Same choices as the web's
 * "Link existing" picker. Pure: no React.
 */
import { validDateKey, type Collections } from "../../../lib/shared.ts"
import { formatDay } from "./dates.ts"

export type RecordLink = NonNullable<Collections["tasks"][number]["recordLinks"]>[number]
export type LinkKind = RecordLink["kind"]
export const MAX_RECORD_LINKS = 50
export const LINK_KINDS: { kind: LinkKind; label: string }[] = [
  { kind: "note", label: "Note" },
  { kind: "task", label: "Task" },
  { kind: "log", label: "Daily log" },
]

export interface Choice { id: string; title: string }
type Source = Pick<Collections, "notes" | "tasks" | "journal">

const firstLine = (text: string) => text.split("\n")[0].trim()
const dayTitle = (key: string) => (validDateKey(key) ? `${formatDay(key)}, ${key.slice(0, 4)}` : key)

/** Everything of one kind that could be linked (a task can't link to itself; logs: today plus every day with a log, newest first). */
export function linkChoices(kind: LinkKind, data: Source, selfId: string | undefined, today: string): Choice[] {
  if (kind === "note") return data.notes.map((n) => ({ id: n.id, title: firstLine(n.text) || "Untitled note" }))
  if (kind === "task") return data.tasks.filter((t) => t.id !== selfId).map((t) => ({ id: t.id, title: t.title }))
  return [...new Set([today, ...data.journal.map((e) => e.id)])].filter(validDateKey).sort().reverse().map((id) => ({ id, title: dayTitle(id) }))
}

export const isLinked = (links: readonly RecordLink[], kind: LinkKind, id: string) => links.some((l) => l.kind === kind && l.id === id)

/** Choices not yet linked, narrowed by search text (case-insensitive), at most `limit` of them. */
export function pickable(choices: readonly Choice[], links: readonly RecordLink[], kind: LinkKind, query: string, limit = 20): Choice[] {
  const needle = query.trim().toLowerCase()
  return choices.filter((c) => !isLinked(links, kind, c.id) && (!needle || c.title.toLowerCase().includes(needle))).slice(0, limit)
}

/** Adds a link unless it is already there or the list is full (the list comes back unchanged then). */
export function addRecordLink(links: readonly RecordLink[], kind: LinkKind, id: string): RecordLink[] {
  return !id || isLinked(links, kind, id) || links.length >= MAX_RECORD_LINKS ? [...links] : [...links, { kind, id }]
}

export const removeRecordLink = (links: readonly RecordLink[], link: RecordLink): RecordLink[] => links.filter((l) => !(l.kind === link.kind && l.id === link.id))

export interface LinkView { key: string; link: RecordLink; label: string; missing: boolean }

/** How a link reads in the editor; a deleted note or task stays visible (so it can be unlinked), labelled as deleted. */
export function describeLink(link: RecordLink, data: Source): LinkView {
  const key = `${link.kind}:${link.id}`
  if (link.kind === "note") {
    const n = data.notes.find((x) => x.id === link.id)
    return { key, link, label: `Note: ${n ? firstLine(n.text) || "Untitled note" : "Deleted note"}`, missing: !n }
  }
  if (link.kind === "task") {
    const t = data.tasks.find((x) => x.id === link.id)
    return { key, link, label: `Task: ${t ? t.title : "Deleted task"}`, missing: !t }
  }
  return { key, link, label: `Log: ${dayTitle(link.id)}`, missing: false }
}
