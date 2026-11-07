import type { PlannerRow } from "./planner/rows.ts"
import { shortDay } from "./planner/dates.ts"

/** One small property tag shown under a selected row (the Planner's own badge colours apply by `kind`). */
export interface RowChip {
  key: string
  label: string
  kind: "date" | "overdue" | "course" | "focus" | "star" | "plain"
  /** The property's name ("Due", "Course"), shown as the chip's key. */
  tag?: string
  /** What follows the key when it differs from `label` (Focus: "On"). */
  value?: string
}

/** The property chips for a selected task row, from the same PlannerRow the Planner list uses. Empty parts are left out. */
export function taskChips(row: PlannerRow): RowChip[] {
  const chips: RowChip[] = []
  if (row.dueText !== "No date") chips.push({ key: "due", tag: "Due", label: row.time ? `${row.dueText} · ${row.time}` : row.dueText, kind: row.overdue && !row.done ? "overdue" : "date" })
  else if (row.time) chips.push({ key: "time", tag: "Time", label: row.time, kind: "date" })
  if (row.course) chips.push({ key: "course", tag: "Course", label: row.course, kind: "course" })
  if (row.focused && !row.done) chips.push({ key: "focus", tag: "Focus", label: "Focus", value: "On", kind: "focus" })
  if (row.starred && !row.done) chips.push({ key: "star", tag: "Priority", label: "Starred", kind: "star" })
  return chips
}

/** The property chips for a selected calendar event: its date and, when set, its start time. */
export function eventChips(date?: string, time?: string): RowChip[] {
  const chips: RowChip[] = []
  if (date) chips.push({ key: "date", tag: "Date", label: shortDay(date), kind: "date" })
  if (time) chips.push({ key: "time", tag: "Time", label: time, kind: "plain" })
  return chips
}
