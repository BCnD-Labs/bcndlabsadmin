import type { LearningItemType, Task } from "../../lib/types.ts"
import { ITEM_TYPES } from "../../lib/course-panels.ts"

export { ITEM_TYPES }

/**
 * Pure coursework helpers (no React, no stores), so they can be unit tested with node --test:
 * item-type tints and the Coursework panel's filter + grouping. Per-course panel prefs are in
 * src/lib/course-panels.ts.
 */

export const itemType = (t: Pick<Task, "learningType">): LearningItemType => t.learningType ?? "assignment"

/**
 * One tint per item type (theme.css `[data-item-type]`, the `--bw-type-*` tokens). They stay
 * clear of the status hues (green done, amber overdue, red error), and events are neutral:
 * they don't count toward progress, so they read lighter. Never color alone: icon + label too.
 */
export type TypeTone = "blue" | "violet" | "cyan" | "neutral"
export const TYPE_TONE: Record<LearningItemType, TypeTone> = { assignment: "blue", exam: "violet", milestone: "cyan", event: "neutral" }
/** Hues reserved for status; a type tint must never be one of these. */
export const STATUS_HUES = ["green", "amber", "red"] as const

/** By date and time, undated last; done items after open ones. */
export function compareCoursework(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  const ad = `${a.due ?? "9999-99-99"} ${a.time ?? "99:99"}`
  const bd = `${b.due ?? "9999-99-99"} ${b.time ?? "99:99"}`
  return ad.localeCompare(bd) || a.createdAt.localeCompare(b.createdAt)
}

/** `YYYY-MM-DD` plus whole days, calendar-safe. */
export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export type CourseworkView = "open" | "done" | "all"
export type CourseworkGroupBy = "when" | "type"
/** How a kind of learning names an item type ("Exam domain" for a certification milestone). */
export interface TypeLabel {
  value: LearningItemType
  label: string
  plural: string
}
export interface CourseworkGroup {
  key: string
  label: string
  tone?: "warn"
  /** Set on type groups. */
  type?: LearningItemType
  items: Task[]
}

/** The tab's items in the panel's existing order: open by date, done newest first, "all" both. */
export function viewItems(items: Task[], view: CourseworkView): Task[] {
  const open = items.filter((t) => !t.done).sort(compareCoursework)
  const done = items.filter((t) => t.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
  return view === "open" ? open : view === "done" ? done : [...open, ...done]
}

/**
 * The type chips to offer: the kind's own types in the kind's order, then any other type that
 * items actually use (a course whose kind changed keeps every item reachable).
 */
export function typeOptions(items: Task[], kindTypes: TypeLabel[], fallback: (t: LearningItemType) => TypeLabel): TypeLabel[] {
  const out = [...kindTypes]
  for (const t of ITEM_TYPES) if (!out.some((x) => x.value === t) && items.some((i) => itemType(i) === t)) out.push(fallback(t))
  return out
}

/** Counts per type for the chips, following the current To do / Done / All tab. `all` is the total. */
export function typeCounts(items: Task[], view: CourseworkView): Record<LearningItemType | "all", number> {
  const shown = viewItems(items, view)
  const counts = { all: shown.length, assignment: 0, exam: 0, milestone: 0, event: 0 }
  for (const t of shown) counts[itemType(t)]++
  return counts
}

/**
 * The Coursework panel's list: the tab's items, narrowed to the chosen types (empty = all),
 * grouped by when (Overdue / Next 7 days / Later / No date, then Done) or by type in the order
 * of `labels`. Order inside every group is the tab's order. Empty groups are left out.
 */
export function courseworkGroups(
  items: Task[],
  { view, types = [], groupBy, labels, today }: { view: CourseworkView; types?: LearningItemType[]; groupBy: CourseworkGroupBy; labels: TypeLabel[]; today: string },
): CourseworkGroup[] {
  const shown = viewItems(items, view).filter((t) => !types.length || types.includes(itemType(t)))
  let groups: CourseworkGroup[]
  if (groupBy === "type") {
    groups = labels.map((l) => ({ key: l.value, label: l.plural, type: l.value, items: shown.filter((t) => itemType(t) === l.value) }))
  } else if (view === "done") {
    groups = [{ key: "done", label: "Done", items: shown }]
  } else {
    const week = addDaysKey(today, 7)
    const open = shown.filter((t) => !t.done)
    groups = [
      { key: "overdue", label: "Overdue", tone: "warn", items: open.filter((t) => t.due && t.due < today) },
      { key: "week", label: "Next 7 days", items: open.filter((t) => t.due && t.due >= today && t.due <= week) },
      { key: "later", label: "Later", items: open.filter((t) => t.due && t.due > week) },
      { key: "nodate", label: "No date", items: open.filter((t) => !t.due) },
      { key: "done", label: "Done", items: shown.filter((t) => t.done) },
    ]
  }
  return groups.filter((g) => g.items.length)
}

/**
 * The item a type panel emphasizes: the next open dated one from today on, else the most
 * overdue open one, else none.
 */
export function nextItem(items: Task[], today: string): Task | undefined {
  const open = items.filter((t) => !t.done && t.due).sort(compareCoursework)
  return open.find((t) => t.due! >= today) ?? open[0]
}
