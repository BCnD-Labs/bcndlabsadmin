/**
 * View-model for the Planner's Tasks tab (pure: no React, no clock). It runs the shared task rules
 * (taskRows / taskGroups, the same calls the web's task browser makes) and turns the result into
 * labelled rows. `today` is always passed in (the phone's local date, see sync-view.ts).
 */
import { compareTasks, inTab, isOverdue, matchesSearch, normalizeSearch, taskGroups, taskRows, validDateKey, type Collections, type TaskTab } from "../../../lib/shared.ts"
import { shortDay } from "./dates.ts"

type Tasks = Collections["tasks"]
type Courses = Collections["courses"]

export interface PlannerRow {
  id: string
  title: string
  starred: boolean
  done: boolean
  overdue: boolean
  /** "Overdue · Nov 2", "Nov 4", or "No date". */
  dueText: string
  /** Time of day on the due date (HH:mm), when set. */
  time?: string
  /** The course's title (or its code) when `courseId` matches a course. */
  course?: string
  /** First line of the task's details, for comfortable rows. */
  details?: string
  /** In today's daily focus. */
  focused: boolean
}

export interface PlannerSection {
  key: string
  /** Null when the group header is hidden (Done, and Today with a single group), as on the web. */
  title: string | null
  warn: boolean
  count: number
  rows: PlannerRow[]
}

export interface PlannerOptions {
  tab: TaskTab
  /** Raw search text. */
  search: string
  today: string
  starredOnly?: boolean
  /** Ids checked off in this view: they stay listed (struck through) until the tab changes. */
  lingering?: ReadonlySet<string>
}

export interface PlannerView {
  /** Today tab only: tasks whose daily focus day is today, listed first (and not repeated in `sections`), open ones before done. */
  focus: PlannerSection | null
  sections: PlannerSection[]
  total: number
  /** Why the list is empty: filters hide everything, or the tab simply has nothing. */
  empty: { filtered: boolean; text: string }
}

const EMPTY_TEXT: Record<TaskTab, string> = { today: "Nothing due today", next: "Nothing scheduled", all: "No open tasks", done: "Nothing completed yet" }

export function dueText(due: string | undefined, overdue: boolean): string {
  if (!due) return "No date"
  const day = validDateKey(due) ? shortDay(due) : due
  return overdue ? `Overdue · ${day}` : day
}

export function plannerRow(task: Tasks[number], courses: Courses, today: string): PlannerRow {
  const course = task.courseId ? courses.find((c) => c.id === task.courseId) : undefined
  const overdue = isOverdue(task, today)
  const details = task.details?.trim().split("\n")[0]
  return { id: task.id, title: task.title, starred: task.starred, done: task.done, overdue, dueText: dueText(task.due, overdue), time: task.time || undefined, course: course ? course.title || course.code : undefined, details: details || undefined, focused: task.focusDate === today }
}

/**
 * The shared `taskGroups` also adds every lingering (just checked off) task to the tab's first
 * group, so one whose own group is a later one is listed twice. Keep the occurrence in its own
 * group (the last one) so each task shows once.
 */
function withoutRepeats<G extends { items: { id: string }[] }>(groups: G[]): G[] {
  const seen = new Set<string>()
  const kept = [...groups].reverse().map((g) => ({ ...g, items: g.items.filter((t) => !seen.has(t.id) && !!seen.add(t.id)) }))
  return kept.reverse().filter((g) => g.items.length)
}

/** Today's daily focus (same search and star filters as the list), open before done, in the shared task order. */
function focusSection(tasks: Tasks, courses: Courses, o: PlannerOptions): PlannerSection | null {
  const needle = normalizeSearch(o.search)
  const picked = tasks.filter((t) => t.focusDate === o.today && matchesSearch(t, needle) && (!o.starredOnly || t.starred)).sort(compareTasks)
  return picked.length ? { key: "focus", title: "Focus today", warn: false, count: picked.length, rows: picked.map((t) => plannerRow(t, courses, o.today)) } : null
}

export function plannerRows(tasks: Tasks, courses: Courses, o: PlannerOptions): PlannerView {
  const focus = o.tab === "today" ? focusSection(tasks, courses, o) : null
  const focusIds = new Set(focus?.rows.map((r) => r.id))
  const rows = taskRows(focus ? tasks.filter((t) => !focusIds.has(t.id)) : tasks, { tab: o.tab, today: o.today, query: o.search, starredOnly: o.starredOnly, lingering: o.lingering })
  const groups = withoutRepeats(taskGroups(rows, { tab: o.tab, today: o.today, lingering: o.lingering }))
  const showTitles = o.tab !== "today" || groups.length > 1
  return {
    focus,
    sections: groups.map((g) => ({
      key: g.name ?? "done",
      title: g.name && showTitles ? g.name : null,
      warn: g.name === "Overdue",
      count: g.items.length,
      rows: g.items.map((t) => plannerRow(t, courses, o.today)),
    })),
    total: rows.length + (focus?.count ?? 0),
    empty: o.search.trim() || o.starredOnly ? { filtered: true, text: "No tasks match" } : { filtered: false, text: EMPTY_TEXT[o.tab] },
  }
}

/** The counts shown on the Today / Next / All tabs (open tasks only, same rule as the web). */
export function tabCounts(tasks: Tasks, today: string): Record<Exclude<TaskTab, "done">, number> {
  const count = (tab: TaskTab) => tasks.filter((t) => inTab(t, tab, today)).length
  return { today: count("today"), next: count("next"), all: count("all") }
}
