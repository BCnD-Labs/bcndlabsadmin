/**
 * String-based date helpers for the Learning skeleton. No Date objects: YYYY-MM-DD strings are
 * converted to a day number with integer math (proleptic Gregorian), so results never depend
 * on the device clock or time zone.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Days since 1970-01-01 for a YYYY-MM-DD string. */
export function dayNumber(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number)
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** The YYYY-MM-DD string for a day number produced by dayNumber. */
export function fromDayNumber(z: number): string {
  const shifted = z + 719468
  const era = Math.floor(shifted / 146097)
  const doe = shifted - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp < 10 ? mp + 3 : mp - 9
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0)
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** A YYYY-MM-DD string moved forward (or back) by whole days. */
export function addDays(ymd: string, days: number): string {
  return fromDayNumber(dayNumber(ymd) + days)
}

/** "Nov 4" for a YYYY-MM-DD string. */
export function shortDate(ymd: string): string {
  const [, month, day] = ymd.split("-").map(Number)
  return `${MONTHS[month - 1]} ${day}`
}
