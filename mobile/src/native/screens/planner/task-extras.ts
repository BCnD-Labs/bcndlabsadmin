/**
 * The task fields beyond title/details/due/time/star/done, as the web's task form and Planner
 * inspector have them: course and learning type (+ score), planned date/time/duration, the daily
 * focus day, linked documents, linked records and the reflection. Pure (no React, no clock).
 *
 * The draft keeps what was typed; `extrasPatch` compares it with what the task started with
 * (field group by field group) so only touched groups are written, and nothing is re-normalised
 * on a task you didn't touch. Emptied lists and cleared fields are explicit undefined.
 */
import { same, validDateKey, validPlannerFields, type Collections, type NewTask } from "../../../lib/shared.ts"
import { cleanLinks, linkProblem, type DocLink } from "./doc-links.ts"
import type { ItemType } from "./learning-types.ts"
import { MAX_RECORD_LINKS, type RecordLink } from "./record-links.ts"
import { buildReflection, emptyReflection, reflectionDraft, reflectionProblem, type ReflectionDraft } from "./reflection.ts"
import { normalizeTime } from "./time.ts"

type Task = Collections["tasks"][number]

export const DURATIONS = [15, 30, 45, 60, 90, 120]

export interface Extras {
  courseId: string
  learningType: ItemType | ""
  score: string
  scheduledDate: string
  scheduledTime: string
  /** Minutes as text, "" for none. */
  duration: string
  focusDate: string
  links: DocLink[]
  recordLinks: RecordLink[]
  reflection: ReflectionDraft
}
export interface ExtraErrors { schedule?: string; duration?: string; score?: string; links?: string; reflection?: string; other?: string }

export const emptyExtras = (): Extras => ({ courseId: "", learningType: "", score: "", scheduledDate: "", scheduledTime: "", duration: "", focusDate: "", links: [], recordLinks: [], reflection: emptyReflection() })

export const extrasFromTask = (t: Task): Extras => ({
  courseId: t.courseId ?? "",
  learningType: t.learningType ?? "",
  score: t.score != null ? String(t.score) : "",
  scheduledDate: t.scheduledDate ?? "",
  scheduledTime: t.scheduledTime ?? "",
  duration: t.durationMinutes != null ? String(t.durationMinutes) : "",
  focusDate: t.focusDate ?? "",
  links: (t.links ?? []).map((l) => ({ ...l })),
  recordLinks: (t.recordLinks ?? []).map((l) => ({ ...l })),
  reflection: reflectionDraft(t.reflection),
})

const minutes = (text: string): number | undefined => (/^\d+$/.test(text.trim()) ? Number(text) : undefined)
const scoreOf = (text: string): number | undefined => (text.trim() === "" ? undefined : Number(text))
const orNone = <T>(list: readonly T[]): T[] | undefined => (list.length ? [...list] : undefined)

/** What the extras mean as task fields. Empty things are undefined; a time without a planned date is dropped. */
function candidate(x: Extras, existing: Task | undefined, now: string) {
  const links = cleanLinks(x.links)
  return {
    courseId: x.courseId || undefined,
    learningType: x.courseId ? x.learningType || undefined : undefined,
    score: x.courseId ? scoreOf(x.score) : undefined,
    scheduledDate: x.scheduledDate || undefined,
    scheduledTime: x.scheduledDate ? normalizeTime(x.scheduledTime) : undefined,
    durationMinutes: minutes(x.duration),
    focusDate: x.focusDate || undefined,
    links: orNone(links),
    recordLinks: orNone(x.recordLinks),
    reflection: buildReflection(x.reflection, existing?.reflection, now),
  }
}
type Candidate = ReturnType<typeof candidate>

/**
 * Why the extras can't be saved, per section. With `start` (what the task began with) only touched
 * sections are checked, so an old oddity elsewhere never blocks an unrelated edit. The shared
 * planner validator has the last word, on the touched fields.
 */
export function extraErrors(x: Extras, start?: Extras): ExtraErrors {
  const e: ExtraErrors = {}
  const touched = (g: number) => !start || !same(GROUPS[g].read(x), GROUPS[g].read(start))
  if (touched(1) || touched(3)) {
    if (x.scheduledDate && !validDateKey(x.scheduledDate)) e.schedule = "Pick a valid planned date."
    else if (x.scheduledDate && x.scheduledTime.trim() && !normalizeTime(x.scheduledTime)) e.schedule = "Use 24-hour time, like 09:30."
    else if (x.focusDate && !validDateKey(x.focusDate)) e.schedule = "Pick a valid focus day."
  }
  const d = minutes(x.duration)
  if (touched(2) && x.duration.trim() && (d === undefined || d < 5 || d > 1440)) e.duration = "Use 5 to 1440 minutes."
  const score = scoreOf(x.score)
  if (touched(0) && x.courseId && score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)) e.score = "Use 0 to 100."
  const links = touched(4) ? linkProblem(x.links) : undefined
  if (links) e.links = links
  const reflection = touched(6) ? reflectionProblem(x.reflection) : undefined
  if (reflection) e.reflection = reflection
  if (touched(5) && x.recordLinks.length > MAX_RECORD_LINKS) e.other = `Up to ${MAX_RECORD_LINKS} linked records.`
  if (!Object.keys(e).length) {
    const next = candidate(x, undefined, "1970-01-01T00:00:00.000Z")
    const row: Record<string, unknown> = {}
    GROUPS.forEach((g, i) => touched(i) && g.keys.forEach((k) => (row[k] = next[k])))
    if (!validPlannerFields(row)) e.other = "Some of these details can't be saved. Check the schedule, links and reflection."
  }
  return e
}

/** Which section (collapsed or not) holds the first error, so the sheet can open it. */
export function errorSection(e: ExtraErrors): "schedule" | "learning" | "links" | "reflection" | "records" | undefined {
  if (e.schedule || e.duration) return "schedule"
  if (e.score) return "learning"
  if (e.links) return "links"
  if (e.reflection) return "reflection"
  return e.other ? "records" : undefined
}

/** A new task's extra fields: only the ones with a value. */
export function newExtras(x: Extras | undefined, now: string): Partial<NewTask> {
  if (!x) return {}
  return Object.fromEntries(Object.entries(candidate(x, undefined, now)).filter(([, v]) => v !== undefined)) as Partial<NewTask>
}

const GROUPS: { keys: (keyof Candidate)[]; read: (x: Extras) => unknown }[] = [
  { keys: ["courseId", "learningType", "score"], read: (x) => [x.courseId, x.learningType, x.score] },
  { keys: ["scheduledDate", "scheduledTime"], read: (x) => [x.scheduledDate, x.scheduledTime] },
  { keys: ["durationMinutes"], read: (x) => x.duration },
  { keys: ["focusDate"], read: (x) => x.focusDate },
  { keys: ["links"], read: (x) => x.links },
  { keys: ["recordLinks"], read: (x) => x.recordLinks },
  { keys: ["reflection"], read: (x) => x.reflection },
]

/** The patch for edited extras: only the groups that differ from what the task started with, and within them only values that really differ. */
export function extrasPatch(x: Extras | undefined, existing: Task, now: string): Partial<NewTask> {
  if (!x) return {}
  const start = extrasFromTask(existing)
  const next = candidate(x, existing, now)
  const out: Record<string, unknown> = {}
  for (const g of GROUPS) {
    if (same(g.read(x), g.read(start))) continue
    for (const k of g.keys) if (!same(existing[k], next[k])) out[k] = next[k]
  }
  return out as Partial<NewTask>
}
