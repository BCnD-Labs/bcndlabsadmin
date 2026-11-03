/** Calendar labels (pure). Day names and month names come from the key's own date, never the phone's locale or clock. */
import { weekdayOfKey } from "../../../../lib/shared.ts"
import type { CalendarView, WeekStart } from "./grid.ts"

export type TimeFormat = "12h" | "24h"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const monthOf = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? ""
const short = (name: string) => name.slice(0, 3)

export const dayNumber = (key: string): number => Number(key.slice(8, 10))
export const weekdayName = (key: string): string => DAYS[weekdayOfKey(key)] ?? ""
export const weekdayShort = (key: string): string => short(weekdayName(key))
/** "Nov 4" */
export const monthDay = (key: string): string => `${short(monthOf(key))} ${dayNumber(key)}`
/** "Wednesday, November 4" (for screen readers and the agenda header). */
export const longDay = (key: string): string => `${weekdayName(key)}, ${monthOf(key)} ${dayNumber(key)}`

/** Column headings for the month grid, starting on the week's first day. */
export function weekdayHeaders(weekStart: WeekStart): string[] {
  return Array.from({ length: 7 }, (_, i) => DAYS[(weekStart + i) % 7].slice(0, 2))
}

/** The calendar title: "November 2026", "Nov 1 – Nov 7, 2026" or "Wednesday, Nov 4". */
export function titleFor(view: CalendarView, key: string, days: readonly string[]): string {
  if (view === "month") return `${monthOf(key)} ${key.slice(0, 4)}`
  if (view === "day") return `${weekdayName(key)}, ${monthDay(key)}`
  return `${monthDay(days[0])} – ${monthDay(days[days.length - 1])}, ${days[days.length - 1].slice(0, 4)}`
}

/** "2:30 PM" or "14:30" for an HH:mm time. Anything that is not HH:mm is returned as it came. */
export function formatTime(time: string, format: TimeFormat): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time)
  if (!m || format === "24h") return time
  const hour = Number(m[1])
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m[2]} ${hour < 12 ? "AM" : "PM"}`
}

/** The time-axis label of a whole hour: "9 AM" or "09:00". */
export function hourLabel(hour: number, format: TimeFormat): string {
  if (format === "24h") return `${String(hour % 24).padStart(2, "0")}:00`
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour % 24 < 12 ? "AM" : "PM"}`
}

/** "1 h 30 min", "45 min", "2 h". */
export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`
}
