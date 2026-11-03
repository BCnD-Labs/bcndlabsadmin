import type { Collections } from "../../../../lib/shared.ts"
import { taskOnDate } from "../calendar/schedule.ts"

/** Only explicit note links from real items on this day; sharing a course is not a link. */
export function linkedNotesForDay(data: Pick<Collections, "tasks" | "notes">, day: string): Collections["notes"] {
  const ids = new Set(data.tasks.filter(t => taskOnDate(t, day)).flatMap(t => (t.recordLinks ?? []).filter(l => l.kind === "note").map(l => l.id)))
  return data.notes.filter(n => ids.has(n.id))
}
