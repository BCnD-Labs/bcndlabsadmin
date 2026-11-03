/**
 * The calendar's two display choices, kept per phone (see prefs-store.ts). Same options and same
 * defaults as the web's Settings: week starts on Sunday or Monday, clock is 12-hour or 24-hour.
 */
import type { WeekStart } from "./grid.ts"
import type { TimeFormat } from "./format.ts"

export interface CalendarPrefs { weekStartsOn: WeekStart; timeFormat: TimeFormat }

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = { weekStartsOn: 0, timeFormat: "12h" }

/** Anything that is not a known choice falls back to the default for that one field. */
export function sanitizeCalendarPrefs(value: unknown): CalendarPrefs {
  const p = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return { weekStartsOn: p.weekStartsOn === 1 ? 1 : 0, timeFormat: p.timeFormat === "24h" ? "24h" : "12h" }
}

/** The saved JSON text back to prefs; null, empty or broken text gives the defaults. */
export function parseCalendarPrefs(raw: string | null | undefined): CalendarPrefs {
  try {
    return sanitizeCalendarPrefs(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...DEFAULT_CALENDAR_PREFS }
  }
}

export const serializeCalendarPrefs = (p: CalendarPrefs): string => JSON.stringify(sanitizeCalendarPrefs(p))
