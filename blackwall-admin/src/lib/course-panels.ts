import type { LearningItemType } from "./types.ts"

/**
 * Per-course type panels on a course page (Learning): course id → the item types whose focused
 * card is switched on. Per browser, in prefs (`coursePanels`), like the Home layout in
 * home-layout.ts; never in the workspace. Stored values are normalized on load, so anything
 * malformed falls back to "all off", and entries for deleted courses are pruned on the next toggle.
 */
export const ITEM_TYPES: LearningItemType[] = ["assignment", "exam", "milestone", "event"]
export const isItemType = (v: unknown): v is LearningItemType => (ITEM_TYPES as unknown[]).includes(v)

/** Anything malformed is dropped; unknown types and duplicates too. Types keep a fixed order. */
export type CoursePanels = Record<string, LearningItemType[]>
const MAX_COURSES = 200
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"])

export function normalizeCoursePanels(raw: unknown): CoursePanels {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: CoursePanels = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_COURSES) break
    if (!id || id.length > 80 || BAD_KEYS.has(id) || !Array.isArray(value)) continue
    const types = ITEM_TYPES.filter((t) => value.includes(t))
    if (types.length) out[id] = types
  }
  return out
}

/** The panels that are on for a course, limited to the types its kind uses, in that order. */
export function coursePanelsFor(map: CoursePanels, courseId: string, allowed: LearningItemType[]): LearningItemType[] {
  const on = Object.hasOwn(map, courseId) && Array.isArray(map[courseId]) ? map[courseId] : []
  return allowed.filter((t) => on.includes(t))
}

/**
 * Turn one type panel on or off. When the live course ids are given, entries for courses that
 * no longer exist are dropped at the same time, so stale ids don't pile up.
 */
export function toggleCoursePanel(map: CoursePanels, courseId: string, type: LearningItemType, on: boolean, liveIds?: Iterable<string>): CoursePanels {
  const clean = normalizeCoursePanels(map)
  if (liveIds) {
    const live = new Set(liveIds)
    for (const id of Object.keys(clean)) if (id !== courseId && !live.has(id)) delete clean[id]
  }
  const current = clean[courseId] ?? []
  const next = on ? ITEM_TYPES.filter((t) => t === type || current.includes(t)) : current.filter((t) => t !== type)
  if (next.length) clean[courseId] = next
  else delete clean[courseId]
  return normalizeCoursePanels(clean)
}
