import type { JournalEntry } from "../../lib/types.ts"
import { SLOTS, checkInSummary, readCheckIn, readSlotCheckIn, reviewId, slotSummary } from "../../../shared/journal-review.ts"

/** The first line that has words, without markdown markers. */
export function previewLine(text: string): string {
  const line = text.split("\n").map((l) => l.replace(/^\s*(#+\s*|[-*]\s+)/, "").trim()).find(Boolean)
  return (line ?? "").slice(0, 90)
}

export interface RecentItem { id: string; label: string; summary: string; text: string }

/** Entries about a task, course or reflection live in Learning and Reflections, not in the plain log. */
const isPlainEntry = (item: NonNullable<JournalEntry["entries"]>[number]) => !item.courseId && !item.taskId

/** The saved pieces behind one day: older day text, named sections, check-ins and log entries. */
export function recentDayItems(journal: readonly JournalEntry[], day: string): RecentItem[] {
  const entry = journal.find((value) => value.id === day)
  const items: RecentItem[] = []
  if (entry?.text.trim()) items.push({ id: "main", label: "Day log", summary: previewLine(entry.text), text: entry.text })
  for (const section of entry?.sections ?? []) items.push({ id: `section/${section.id}`, label: section.title, summary: previewLine(section.text) || "No text saved yet", text: section.text })
  for (const item of entry?.entries ?? []) {
    if (!isPlainEntry(item)) continue
    const slot = SLOTS.find((value) => item.id === reviewId("daily", day, value.key))
    const earlier = item.id === reviewId("daily", day)
    const section = entry?.sections?.find((s) => s.id === item.sectionId)
    items.push({
      id: `entry/${item.id}`,
      label: slot ? `${slot.label} check-in` : earlier ? "Earlier check-in" : item.id.startsWith("journal-") ? "Review" : section?.title ?? "Log entry",
      summary: slot ? slotSummary(slot.key, readSlotCheckIn(slot.key, item.text)) : earlier ? checkInSummary(readCheckIn(item.text)) : previewLine(item.text),
      text: item.text,
    })
  }
  return items
}

export interface RecentDay { day: string; preview: string }

/** The latest days with something saved, newest first. Weekly, monthly and yearly reviews are left out: they have their own tabs. */
export function recentDays(journal: readonly JournalEntry[], limit = 8): RecentDay[] {
  return journal
    .filter((entry) => !entry.id.startsWith("journal-"))
    .map((entry) => ({ day: entry.id, preview: recentDayItems(journal, entry.id).map((item) => item.summary).find(Boolean) ?? "" }))
    .filter((entry) => entry.preview)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, limit)
}
