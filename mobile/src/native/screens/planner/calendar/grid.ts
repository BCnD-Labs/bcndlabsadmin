/**
 * Calendar grid math on YYYY-MM-DD keys (pure: no Date objects, no clock, no time zone). Built on the
 * shared date-key helpers the web uses. Week start is 0 (Sunday) or 1 (Monday), as in the web's
 * Settings.
 */
import { addDaysToKey, daysBetween, weekdayOfKey } from "../../../../lib/shared.ts"

export type WeekStart = 0 | 1
export type CalendarView = "day" | "week" | "month"

/** `n` days after `key`. An invalid key comes back unchanged so a bad value can never crash a screen. */
export const shift = (key: string, n: number): string => addDaysToKey(key, n) ?? key

/** The first day of the week that contains `key`. */
export function weekStartKey(key: string, weekStart: WeekStart): string {
  const back = (((weekdayOfKey(key) - weekStart) % 7) + 7) % 7
  return shift(key, -(Number.isNaN(back) ? 0 : back))
}

/** The seven days of the week that contains `key`. */
export function weekOf(key: string, weekStart: WeekStart): string[] {
  const first = weekStartKey(key, weekStart)
  return Array.from({ length: 7 }, (_, i) => shift(first, i))
}

export const sameMonth = (a: string, b: string): boolean => a.slice(0, 7) === b.slice(0, 7)

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

const parts = (key: string): [number, number, number] => [Number(key.slice(0, 4)), Number(key.slice(5, 7)), Number(key.slice(8, 10))]
const pad = (n: number, w = 2) => String(n).padStart(w, "0")

export const monthStartKey = (key: string): string => `${key.slice(0, 7)}-01`

export function monthEndKey(key: string): string {
  const [y, m] = parts(key)
  return `${pad(y, 4)}-${pad(m)}-${pad(daysInMonth(y, m))}`
}

/** The same day `n` months on, clamped to the shorter month (Jan 31 + 1 month = Feb 28 or 29). */
export function addMonths(key: string, n: number): string {
  const [y, m, d] = parts(key)
  const index = y * 12 + (m - 1) + n
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${pad(year, 4)}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`
}

/** The month as whole weeks (four to six rows of seven days), with the neighbouring months' days filling the ends. */
export function monthGrid(key: string, weekStart: WeekStart): string[][] {
  const first = weekStartKey(monthStartKey(key), weekStart)
  const rows = Math.ceil((daysBetween(monthEndKey(key), first) + 1) / 7)
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, c) => shift(first, r * 7 + c)))
}

/** One step of the header arrows: a day, a week or a month. */
export function stepBy(view: CalendarView, key: string, direction: 1 | -1): string {
  return view === "month" ? addMonths(key, direction) : shift(key, direction * (view === "week" ? 7 : 1))
}

/** The days a view lays out as columns. */
export function columnsFor(view: CalendarView, key: string, weekStart: WeekStart): string[] {
  return view === "day" ? [key] : weekOf(key, weekStart)
}
