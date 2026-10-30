import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
} from "date-fns"
import type { DateKey } from "./types"

export const toDateKey = (d: Date): DateKey => format(d, "yyyy-MM-dd")
export const todayKey = (): DateKey => toDateKey(new Date())
export const offsetKey = (days: number): DateKey => toDateKey(addDays(new Date(), days))

export function parseKey(key: DateKey): Date {
  // Parse as local midnight, not UTC.
  const d = parseISO(key)
  return isValid(d) ? d : new Date(NaN)
}

/** Days from today; negative is overdue. */
export function daysUntil(key: DateKey): number {
  return differenceInCalendarDays(parseKey(key), new Date())
}

export function relativeDue(key: DateKey): string {
  const n = daysUntil(key)
  if (n === 0) return "Today"
  if (n === 1) return "Tomorrow"
  if (n === -1) return "Yesterday"
  if (n < 0) return `${-n}d overdue`
  if (n < 7) return format(parseKey(key), "EEE")
  return format(parseKey(key), "MMM d")
}

export function timeAgo(iso: string): string {
  const d = parseISO(iso)
  if (!isValid(d)) return ""
  return formatDistanceToNowStrict(d, { addSuffix: true })
}

export function formatTime(hhmm?: string): string {
  if (!hhmm) return "All day"
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return format(d, "h:mm a")
}
