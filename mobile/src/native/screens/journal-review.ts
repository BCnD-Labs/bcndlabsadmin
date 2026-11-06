import { addDays, weekDays } from "./planner/dates.ts"

export type Period = "daily" | "weekly" | "monthly" | "yearly"
export type CheckIn = { mood: string; energy: string; win: string; hard: string; grateful: string; checks: string[]; notes: string }
export const EMPTY_CHECK_IN: CheckIn = { mood: "", energy: "", win: "", hard: "", grateful: "", checks: [], notes: "" }
export const CHECKS = ["Learned", "Made progress", "Connected", "Rested", "Moved"] as const

export function periodStart(period: Period, day: string): string {
  if (period === "weekly") return weekDays(day)[0]
  if (period === "monthly") return `${day.slice(0, 7)}-01`
  if (period === "yearly") return `${day.slice(0, 4)}-01-01`
  return day
}

export function nextPeriod(period: Period, start: string, direction: 1 | -1): string {
  if (period === "daily") return addDays(start, direction)
  if (period === "weekly") return addDays(start, direction * 7)
  const year = Number(start.slice(0, 4)), month = Number(start.slice(5, 7))
  const date = new Date(Date.UTC(year + (period === "yearly" ? direction : 0), month - 1 + (period === "monthly" ? direction : 0), 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
}

export function reviewId(period: Period, start: string): string { return `journal-${period}-${start}` }

/** Human-readable text, so the web and Mac apps can display a check-in without understanding this form. */
export function writeCheckIn(period: Period, form: CheckIn): string {
  const lines = [`## ${period[0].toUpperCase()}${period.slice(1)} check-in`]
  for (const [label, value] of [["Mood", form.mood], ["Energy", form.energy], ["Win", form.win], ["Hard", form.hard], ["Grateful", form.grateful]]) {
    if (value.trim()) lines.push(`${label}: ${value.trim().replace(/\s*\n\s*/g, " ")}`)
  }
  for (const label of CHECKS) if (form.checks.includes(label)) lines.push(`- [x] ${label}`)
  if (form.notes.trim()) lines.push("", "Notes:", form.notes.trim())
  return lines.join("\n")
}

export function readCheckIn(text: string): CheckIn {
  const form: CheckIn = { ...EMPTY_CHECK_IN, checks: [] }
  const [head, ...notes] = text.split("\nNotes:\n")
  for (const line of head.split("\n")) {
    const field = /^(Mood|Energy|Win|Hard|Grateful): (.*)$/.exec(line)
    if (field) {
      const key = field[1].toLowerCase() as "mood" | "energy" | "win" | "hard" | "grateful"
      form[key] = field[2]
    }
    const check = /^- \[x\] (.*)$/.exec(line)
    if (check && CHECKS.some(label => label === check[1])) form.checks.push(check[1])
  }
  form.notes = notes.join("\nNotes:\n")
  return form
}

export const hasCheckIn = (form: CheckIn): boolean => !!(form.mood || form.energy || form.win.trim() || form.hard.trim() || form.grateful.trim() || form.checks.length || form.notes.trim())
