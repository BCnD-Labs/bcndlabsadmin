import type { JournalLogItem, JournalSection } from "../src/lib/types.ts"
import { validReflection } from "./planner.ts"

export const MAX_LOG_SECTIONS = 3
export const MAX_SECTION_TITLE = 40

/** Optional, explicitly named sections; older entries have no sections field. */
export function validJournalSections(value: unknown): value is JournalSection[] {
  if (!Array.isArray(value) || value.length > MAX_LOG_SECTIONS) return false
  const ids = new Set<string>()
  return value.every((section) => {
    if (!section || typeof section !== "object" || typeof section.id !== "string" || !section.id || section.id.length > 100 || ids.has(section.id)) return false
    ids.add(section.id)
    return typeof section.title === "string" && !!section.title.trim() && section.title.length <= MAX_SECTION_TITLE && typeof section.text === "string" && section.text.length <= 1_000_000 && validOptionalId(section.noteId)
  })
}


const validOptionalId = (value: unknown) => value === undefined || (typeof value === "string" && !!value && value.length <= 100)

export function validJournalItems(value: unknown, sections: readonly JournalSection[] = []): value is JournalLogItem[] {
  if (!Array.isArray(value) || value.length > 10_000) return false
  const ids = new Set<string>()
  return value.every((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || item.id.length > 100 || ids.has(item.id)) return false
    ids.add(item.id)
    return typeof item.text === "string" && item.text.length <= 1_000_000 && typeof item.createdAt === "string" && typeof item.updatedAt === "string" && validOptionalId(item.noteId) && validOptionalId(item.sectionId) && validOptionalId(item.courseId) && validOptionalId(item.taskId) && (item.reflection == null || validReflection(item.reflection)) && (item.sectionId === undefined || sections.some((section) => section.id === item.sectionId))
  })
}
