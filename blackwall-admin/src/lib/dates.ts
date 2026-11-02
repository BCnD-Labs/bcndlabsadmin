import { usePrefs } from "@/stores/prefs"
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
  return format(d, timeFmt())
}

/** Compact age for dense lists: "now", "12m", "3h", "2d", "5w". */
export function shortAgo(iso: string, now = new Date()): string {
  const d = parseISO(iso)
  if (!isValid(d)) return ""
  const m = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000))
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  if (m < 60 * 24) return `${Math.floor(m / 60)}h`
  if (m < 60 * 24 * 7) return `${Math.floor(m / 1440)}d`
  return `${Math.floor(m / 10080)}w`
}

/** The clock pattern from Settings → General (12-hour by default). */
export const timeFmt = () => (usePrefs.getState().timeFormat === "24h" ? "HH:mm" : "h:mm a")
/** First day of the week from Settings → General: 0 Sunday (default), 1 Monday. */
export const weekStart = (): 0 | 1 => usePrefs.getState().weekStartsOn
