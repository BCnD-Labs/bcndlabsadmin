import { daysUntil } from "@/lib/dates"
import type { Task } from "@/lib/types"

export type TaskFilter = "today" | "upcoming" | "all" | "done"

export const TASK_FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
  { value: "done", label: "Done" },
]

export const isOverdue = (t: Task) => !t.done && !!t.due && daysUntil(t.due) < 0

/** Open tasks that are overdue, due today, or starred. */
export const isForToday = (t: Task) => !t.done && ((!!t.due && daysUntil(t.due) <= 0) || t.starred)

export function matchesFilter(t: Task, f: TaskFilter): boolean {
  switch (f) {
    case "today":
      return isForToday(t)
    case "upcoming":
      return !t.done && !isForToday(t)
    case "all":
      return !t.done
    case "done":
      return t.done
  }
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

export type TaskGroup = "Overdue" | "Today" | "Tomorrow" | "Next 7 days" | "Later" | "No date"

export function groupOf(t: Task): TaskGroup {
  if (!t.due) return "No date"
  const n = daysUntil(t.due)
  if (n < 0) return "Overdue"
  if (n === 0) return "Today"
  if (n === 1) return "Tomorrow"
  if (n <= 7) return "Next 7 days"
  return "Later"
}

export const GROUP_ORDER: TaskGroup[] = ["Overdue", "Today", "Tomorrow", "Next 7 days", "Later", "No date"]
