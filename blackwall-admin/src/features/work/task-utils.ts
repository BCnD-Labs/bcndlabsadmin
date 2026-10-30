import { daysUntil } from "@/lib/dates"
import type { Priority, Task } from "@/lib/types"

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export type TaskFilter = "attention" | "today" | "upcoming" | "all" | "done"

export const TASK_FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "attention", label: "Attention" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All open" },
  { value: "done", label: "Done" },
]

/** Open tasks that are overdue, due today, in progress, urgent, or high priority due within 3 days. */
export function needsAttention(t: Task): boolean {
  if (t.status === "done") return false
  if (t.status === "in-progress" || t.priority === "urgent") return true
  if (!t.due) return false
  const n = daysUntil(t.due)
  return n <= 0 || (t.priority === "high" && n <= 3)
}

export function isOverdue(t: Task): boolean {
  return t.status !== "done" && !!t.due && daysUntil(t.due) < 0
}

export function matchesFilter(t: Task, f: TaskFilter): boolean {
  switch (f) {
    case "attention":
      return needsAttention(t)
    case "today":
      return t.status !== "done" && !!t.due && daysUntil(t.due) <= 0
    case "upcoming":
      return t.status !== "done" && !!t.due && daysUntil(t.due) > 0
    case "all":
      return t.status !== "done"
    case "done":
      return t.status === "done"
  }
}

/** Overdue first, then by due date (undated last), then priority. Done tasks: most recent first. */
export function compareTasks(a: Task, b: Task): number {
  if (a.status === "done" && b.status === "done") {
    return (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
  }
  if (a.status === "done") return 1
  if (b.status === "done") return -1
  const ad = a.due ?? "9999-99-99"
  const bd = b.due ?? "9999-99-99"
  if (ad !== bd) return ad.localeCompare(bd)
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}
