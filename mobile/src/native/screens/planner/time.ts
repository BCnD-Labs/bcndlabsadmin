/** "9:30" or "09:30" -> "09:30"; undefined when empty or not a 24-hour time. */
export function normalizeTime(text: string): string | undefined {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined
  return `${m[1].padStart(2, "0")}:${m[2]}`
}
