/** Pure validation shared by workspace imports/API writes and Planner tests. */
export const REFLECTION_ITEMS = {
  difficulty: { label: "Difficulty", options: ["Easy", "Moderate", "Hard"] },
  timeSpent: { label: "Time spent", options: ["5 min", "15 min", "30 min", "45 min", "1 hour", "2 hours"] },
  help: { label: "Help used", options: ["None", "Reference guide", "Another person", "AI assistance"] },
  outcome: { label: "Outcome", options: ["As expected", "Better than expected", "Needs follow-up"] },
  nextTime: { label: "Next time", options: [] },
  learned: { label: "What I learned", options: [] },
  blocker: { label: "What got in the way", options: [] },
} as const

export function validDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validPlannerFields(row: Record<string, unknown>): boolean {
  if (row.kind !== undefined && row.kind !== "task" && row.kind !== "event") return false
  if (row.kind === "event" && !validDateKey(row.scheduledDate)) return false
  for (const key of ["focusDate", "scheduledDate"]) if (row[key] != null && !validDateKey(row[key])) return false
  if (row.scheduledTime != null && (typeof row.scheduledTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.scheduledTime) || !row.scheduledDate)) return false
  if (row.durationMinutes != null && (typeof row.durationMinutes !== "number" || !Number.isInteger(row.durationMinutes) || row.durationMinutes < 5 || row.durationMinutes > 1440)) return false
  if (row.recordLinks != null && (!Array.isArray(row.recordLinks) || row.recordLinks.length > 50 || !row.recordLinks.every((link: unknown) => {
    if (!link || typeof link !== "object") return false
    const item = link as Record<string, unknown>
    return ["note", "task", "log"].includes(String(item.kind)) && typeof item.id === "string" && item.id.length > 0 && (item.kind !== "log" || validDateKey(item.id))
  }))) return false
  if (row.reflection != null) {
    if (typeof row.reflection !== "object" || Array.isArray(row.reflection)) return false
    const value = row.reflection as Record<string, unknown>
    if (typeof value.text !== "string" || value.text.length > 100_000 || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) return false
    if (!value.items || typeof value.items !== "object" || Array.isArray(value.items)) return false
    if (!Object.entries(value.items).every(([key, item]) => Object.hasOwn(REFLECTION_ITEMS, key) && typeof item === "string" && item.length <= 10_000)) return false
  }
  return true
}
