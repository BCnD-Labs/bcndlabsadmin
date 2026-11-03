/**
 * Pure `YYYY-MM-DD` date-key math (calendar days, no time zones, no clock) shared by the web and the
 * native apps. Equivalent to the date-fns calls the web used (`differenceInCalendarDays`, `addDays`,
 * `getDay`); tests/task-rules.test.ts proves it against date-fns. Invalid keys give NaN / undefined.
 */
import { validDateKey } from "./planner.ts"

const DAY_MS = 86_400_000

/** Whole days since 1970-01-01 for a valid key, NaN otherwise. */
export function dayNumber(key: string): number {
  return validDateKey(key) ? Date.parse(`${key}T00:00:00Z`) / DAY_MS : NaN
}

/** Calendar days from `from` to `key`; negative when `key` is earlier. NaN if either is invalid. */
export function daysBetween(key: string, from: string): number {
  return dayNumber(key) - dayNumber(from)
}

/** The key `n` calendar days after `key` (n may be negative). Undefined for an invalid key. */
export function addDaysToKey(key: string, n: number): string | undefined {
  const d = dayNumber(key)
  return Number.isNaN(d) ? undefined : new Date((d + n) * DAY_MS).toISOString().slice(0, 10)
}

/** 0 = Sunday ... 6 = Saturday (same numbering as date-fns `getDay`). NaN for an invalid key. */
export function weekdayOfKey(key: string): number {
  const d = dayNumber(key)
  return Number.isNaN(d) ? NaN : (((d + 4) % 7) + 7) % 7 // 1970-01-01 was a Thursday
}
