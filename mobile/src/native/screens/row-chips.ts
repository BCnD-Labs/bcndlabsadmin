import type { PlannerRow } from "./planner/rows.ts"
import { shortDay } from "./planner/dates.ts"

/** One small property tag shown under a selected row (the Planner's own badge colours apply by `kind`). */
export interface RowChip { key: string; label: string; kind: "date" | "overdue" | "course" | "focus" | "star" | "plain" }

/** The property chips for a selected task row, from the same PlannerRow the Planner list uses. Empty parts are left out. */
export function taskChips(row: PlannerRow): RowChip[] {
  const chips: RowChip[] = []
  if (row.dueText !== "No date") chips.push({ key: "due", label: row.time ? `${row.dueText} · ${row.time}` : row.dueText, kind: row.overdue && !row.done ? "overdue" : "date" })
  else if (row.time) chips.push({ key: "time", label: row.time, kind: "date" })
  if (row.course) chips.push({ key: "course", label: row.course, kind: "course" })
  if (row.focused && !row.done) chips.push({ key: "focus", label: "Focus", kind: "focus" })
  if (row.starred && !row.done) chips.push({ key: "star", label: "Starred", kind: "star" })
  return chips
}

/** The property chips for a selected calendar event: its date and, when set, its start time. */
export function eventChips(date?: string, time?: string): RowChip[] {
  const chips: RowChip[] = []
  if (date) chips.push({ key: "date", label: shortDay(date), kind: "date" })
  if (time) chips.push({ key: "time", label: time, kind: "plain" })
  return chips
}
