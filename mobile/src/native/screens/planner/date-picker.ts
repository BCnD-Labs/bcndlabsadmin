/**
 * Pure helpers behind the task editor's date picker (no React, no clock): a Monday-first month
 * grid and the quick-pick dates. Built on the shared date-key helpers, so a key is always a
 * valid `YYYY-MM-DD` and nothing depends on the phone's time zone.
 */
import { addDaysToKey, daysBetween, validDateKey, weekdayOfKey } from "../../../lib/shared.ts"

export interface Month { year: number; month: number } // month is 1 to 12
export interface MonthCell { key: string; day: number; inMonth: boolean }
export interface QuickDate { label: string; /** Undefined = "No date". */ value: string | undefined }

const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const two = (n: number) => String(n).padStart(2, "0")

/** The month a valid key is in; undefined for anything else. */
export function monthOf(key: string): Month | undefined {
  return validDateKey(key) ? { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) } : undefined
}

export function monthKey(m: Month, day = 1): string {
  return `${String(m.year).padStart(4, "0")}-${two(m.month)}-${two(day)}`
}

export function shiftMonth(m: Month, delta: number): Month {
  const index = m.year * 12 + (m.month - 1) + delta
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 }
}

/** "November 2026" */
export function monthLabel(m: Month): string {
  return `${NAMES[m.month - 1]} ${m.year}`
}

/** Weeks (Monday to Sunday) covering the month; days from the neighbouring months are `inMonth: false`. */
export function monthGrid(m: Month): MonthCell[][] {
  const first = monthKey(m)
  const length = daysBetween(monthKey(shiftMonth(m, 1)), first)
  const lead = (weekdayOfKey(first) + 6) % 7 // Monday = 0
  const weeks = Math.ceil((lead + length) / 7)
  const start = addDaysToKey(first, -lead) as string
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const key = addDaysToKey(start, w * 7 + d) as string
      return { key, day: Number(key.slice(8, 10)), inMonth: key.slice(0, 7) === first.slice(0, 7) }
    }),
  )
}

/** The chips above the grid. "Next week" is the coming Monday (always 1 to 7 days away). */
export function quickDates(today: string): QuickDate[] {
  const untilMonday = 7 - ((weekdayOfKey(today) + 6) % 7)
  return [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDaysToKey(today, 1) },
    { label: "Next week", value: addDaysToKey(today, untilMonday) },
    { label: "No date", value: undefined },
  ]
}
