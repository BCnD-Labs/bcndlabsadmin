/** One-line summaries shown on the editor's collapsed sections (pure). They only say what the draft holds. */
import { validDateKey, type Collections } from "../../../lib/shared.ts"
import { shortDay } from "./dates.ts"
import { courseLabel, typeLabel } from "./learning-types.ts"
import { reflectionPreview } from "./reflection.ts"
import type { Extras } from "./task-extras.ts"

const day = (key: string) => (validDateKey(key) ? shortDay(key) : key)
const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "None")

export function scheduleSummary(x: Extras, today: string): string {
  const planned = x.scheduledDate ? [day(x.scheduledDate), x.scheduledTime].filter(Boolean).join(" ") : ""
  const focus = x.focusDate ? (x.focusDate === today ? "Focus today" : `Focus ${day(x.focusDate)}`) : ""
  return [planned, x.duration ? `${x.duration} min` : "", focus].filter(Boolean).join(" · ") || "Not scheduled"
}

export function learningSummary(x: Extras, courses: Collections["courses"]): string {
  const course = courses.find((c) => c.id === x.courseId)
  if (!x.courseId) return "No course"
  const name = course ? courseLabel(course) : "Unknown course"
  return [name, x.learningType ? typeLabel(x.learningType, course?.kind) : "", x.score ? `${x.score}%` : ""].filter(Boolean).join(" · ")
}

export const reflectionSummary = (x: Extras): string => reflectionPreview(x.reflection)
export const linksSummary = (x: Extras): string => count(x.links.length, "link", "links")
export const recordsSummary = (x: Extras): string => count(x.recordLinks.length, "linked record", "linked records")
