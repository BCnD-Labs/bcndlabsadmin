/**
 * Pure calendar helpers for the Planner and Home skeletons. Dates are YYYY-MM-DD strings and the
 * math is integer arithmetic only (proleptic Gregorian, no Date objects), so results never depend
 * on the device clock or time zone. Weeks run Monday to Sunday.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export const WEEKDAY_SHORT = WEEKDAYS

/** Days since 1970-01-01 for a civil date. */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const mp = (month + 9) % 12
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Inverse of daysFromCivil: [year, month 1-12, day]. */
function civilFromDays(z: number): [number, number, number] {
  const shifted = z + 719468
  const era = Math.floor(shifted / 146097)
  const doe = shifted - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp < 10 ? mp + 3 : mp - 9
  const year = yoe + era * 400
  return [month <= 2 ? year + 1 : year, month, day]
}

function parts(ymd: string): [number, number, number] {
  const [year, month, day] = ymd.split("-").map(Number)
  return [year, month, day]
}

function toDayNumber(ymd: string): number {
  const [year, month, day] = parts(ymd)
  return daysFromCivil(year, month, day)
}

function fromDayNumber(z: number): string {
  const [year, month, day] = civilFromDays(z)
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** The date `days` after (or before, when negative) a YYYY-MM-DD string. */
export function addDays(ymd: string, days: number): string {
  return fromDayNumber(toDayNumber(ymd) + days)
}

/** 0 = Monday ... 6 = Sunday. 1970-01-01 was a Thursday (index 3). */
export function weekdayIndex(ymd: string): number {
  return (((toDayNumber(ymd) + 3) % 7) + 7) % 7
}

/** The seven days (Monday to Sunday) of the week that contains the given day. */
export function weekDays(ymd: string): string[] {
  const monday = addDays(ymd, -weekdayIndex(ymd))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** "Mon, Nov 2" */
export function formatDay(ymd: string): string {
  const [, month, day] = parts(ymd)
  return `${WEEKDAYS[weekdayIndex(ymd)]}, ${MONTHS[month - 1]} ${day}`
}

/** "Nov 2" */
export function shortDay(ymd: string): string {
  const [, month, day] = parts(ymd)
  return `${MONTHS[month - 1]} ${day}`
}

/** The day of the month as a number. */
export function dayOfMonth(ymd: string): number {
  return parts(ymd)[2]
}

/** "Nov 2 – Nov 8" for the Monday to Sunday week that contains the given day. */
export function weekRangeLabel(ymd: string): string {
  const days = weekDays(ymd)
  return `${shortDay(days[0])} – ${shortDay(days[6])}`
}
