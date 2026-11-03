/**
 * Pure task rules shared by the web Planner/Home and the native apps: which group a task is in, how
 * tasks sort, the Today/Next/All/Done views, search, and the quick-add parser. "Today" is always a
 * `YYYY-MM-DD` parameter; nothing here reads the clock, prefs or the browser. The web keeps thin
 * wrappers that pass `todayKey()`.
 */
import type { Task } from "../src/lib/types.ts"
import { addDaysToKey, daysBetween, weekdayOfKey } from "./date-keys.ts"

/** Days from today to `due`; negative is overdue (NaN for an invalid key, which matches no view test). */
export const daysUntil = (due: string, today: string) => daysBetween(due, today)

export type TaskGroup = "Overdue" | "Today" | "Tomorrow" | "Next 7 days" | "Later" | "No date"
export const GROUP_ORDER: TaskGroup[] = ["Overdue", "Today", "Tomorrow", "Next 7 days", "Later", "No date"]

export function groupOf(t: Task, today: string): TaskGroup {
  if (!t.due) return "No date"
  const n = daysUntil(t.due, today)
  if (n < 0) return "Overdue"
  if (n === 0) return "Today"
  if (n === 1) return "Tomorrow"
  if (n <= 7) return "Next 7 days"
  return "Later"
}

/** Dated tasks first by date, then undated; starred first within a day. Done: most recent first. */
export function compareTasks(a: Task, b: Task): number {
  if (a.done && b.done) return (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
  if (a.done !== b.done) return a.done ? 1 : -1
  const ad = a.due ?? "9999-99-99"
  const bd = b.due ?? "9999-99-99"
  if (ad !== bd) return ad.localeCompare(bd)
  if (a.starred !== b.starred) return a.starred ? -1 : 1
  return a.createdAt.localeCompare(b.createdAt)
}

export const isOverdue = (t: Task, today: string) => !t.done && !!t.due && daysUntil(t.due, today) < 0

// Planner task browser views (Today / Next / All / Done).
export type TaskTab = "today" | "next" | "all" | "done"
export const TASK_TABS: { value: TaskTab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "next", label: "Next" },
  { value: "all", label: "All" },
  { value: "done", label: "Done" },
]

/** Today = open, due today or overdue. Next = open, due after today (undated tasks only show in All). */
export function inTab(t: Task, tab: TaskTab, today: string): boolean {
  if (tab === "done") return t.done
  if (t.done) return false
  if (tab === "today") return !!t.due && daysUntil(t.due, today) <= 0
  if (tab === "next") return !!t.due && daysUntil(t.due, today) > 0
  return true
}

/** The groups each open view shows, in order. Done is a single ungrouped list. */
export const TAB_GROUPS: Record<Exclude<TaskTab, "done">, TaskGroup[]> = {
  today: ["Overdue", "Today"],
  next: ["Tomorrow", "Next 7 days", "Later"],
  all: GROUP_ORDER,
}

export function reflectionSummary(task: Task): string {
  return [task.reflection?.text, ...Object.values(task.reflection?.items ?? {})].filter(Boolean).join(" · ")
}

/** Lower-cased, trimmed search text; empty means "no search". */
export const normalizeSearch = (q: string) => q.trim().toLowerCase()

/** Title, details or reflection contains the (already normalized) needle. An empty needle matches. */
export function matchesSearch(t: Task, needle: string): boolean {
  return !needle || t.title.toLowerCase().includes(needle) || !!t.details?.toLowerCase().includes(needle) || reflectionSummary(t).toLowerCase().includes(needle)
}

export interface TaskViewOptions {
  tab: TaskTab
  today: string
  /** Raw search box text. */
  query?: string
  starredOnly?: boolean
  /** Ids checked off in this view: they stay listed (struck through) until the tab changes. */
  lingering?: ReadonlySet<string>
}

/** The sorted rows of a view: tab (plus lingering), search and starred filter. */
export function taskRows(tasks: readonly Task[], o: TaskViewOptions): Task[] {
  const needle = normalizeSearch(o.query ?? "")
  return tasks
    .filter((t) => (inTab(t, o.tab, o.today) || !!o.lingering?.has(t.id)) && matchesSearch(t, needle) && (!o.starredOnly || t.starred))
    .sort(compareTasks)
}

/** Rows split into the view's groups, empty groups dropped. Done has one unnamed group. */
export function taskGroups(rows: readonly Task[], o: Pick<TaskViewOptions, "tab" | "today" | "lingering">): { name: TaskGroup | null; items: Task[] }[] {
  if (o.tab === "done") return [{ name: null, items: [...rows] }]
  const names = TAB_GROUPS[o.tab]
  return names
    .map((g) => ({ name: g as TaskGroup | null, items: rows.filter((t) => groupOf(t, o.today) === g || (t.done && !!o.lingering?.has(t.id) && g === names[0])) }))
    .filter((g) => g.items.length)
}

// Home "Tasks" panel filters (Today also includes starred tasks).
export type TaskFilter = "today" | "upcoming" | "all" | "done"
export const TASK_FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
  { value: "done", label: "Done" },
]

/** Open tasks that are overdue, due today, or starred. */
export const isForToday = (t: Task, today: string) => !t.done && ((!!t.due && daysUntil(t.due, today) <= 0) || t.starred)

export function matchesFilter(t: Task, f: TaskFilter, today: string): boolean {
  switch (f) {
    case "today":
      return isForToday(t, today)
    case "upcoming":
      return !t.done && !isForToday(t, today)
    case "all":
      return !t.done
    case "done":
      return t.done
  }
}

/** Home Productivity panel tabs: Next also lists undated open tasks. */
export type HomeTab = "today" | "next" | "done"
export const inHomeTab = (t: Task, tab: HomeTab, today: string) =>
  tab === "done" ? t.done : !t.done && (tab === "today" ? !!t.due && daysUntil(t.due, today) <= 0 : !t.due || daysUntil(t.due, today) > 0)

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

/**
 * Pull a trailing date word off a quick-add title: "today", "tomorrow"/"tmrw"/"tmr", or a weekday
 * ("fri", "thurs", "friday" = the next one, or today if it matches). Anything else is left alone.
 */
export function parseQuickAdd(input: string, today: string): { title: string; due?: string } {
  const text = input.trim()
  const m = text.match(/\s+([a-z]+)$/i)
  if (!m) return { title: text }
  const title = text.slice(0, m.index).trim()
  const word = m[1].toLowerCase().replace(/^weds$/, "wed")
  if (!title) return { title: text }
  if (word === "today") return { title, due: today }
  if (["tomorrow", "tmrw", "tmr"].includes(word)) return { title, due: addDaysToKey(today, 1) }
  const idx = word.length >= 3 ? WEEKDAYS.findIndex((d) => d.startsWith(word)) : -1
  if (idx < 0) return { title: text }
  return { title, due: addDaysToKey(today, (idx - weekdayOfKey(today) + 7) % 7) }
}
