/**
 * Pure rules for the Planner's Notes (no React, no clock: `now` is passed in). Mirrors the web
 * (features/productivity/planner-notes.tsx, features/notes/note-colors.ts): newest-edited first with
 * pinned notes grouped on top, search over the note text, the five paper colours, the first line as a
 * note's name, and the age shown as "5m", "3h", "2d", "1w".
 */
import type { Collections } from "../../../../lib/shared.ts"

export type Note = Collections["notes"][number]
export type NoteColor = Note["color"]
type Courses = Collections["courses"]

/** The web's NoteColor values with its labels, in its order. */
export const NOTE_COLORS: { value: NoteColor; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "amber", label: "Yellow" },
  { value: "teal", label: "Mint" },
  { value: "rose", label: "Pink" },
  { value: "blue", label: "Blue" },
]

/** A colour from a newer version the app does not know shows as plain, as on the web. */
export const colorOf = (c: string): NoteColor => (NOTE_COLORS.some((n) => n.value === c) ? (c as NoteColor) : "plain")

/** First line of a note, used as its name in lists. */
export const noteTitle = (text: string): string => text.trim().split("\n")[0]?.slice(0, 80) || "Empty note"

/** The rest of the note after its first line, on one line. */
export function notePreview(text: string): string {
  return text.trim().split("\n").slice(1).map((l) => l.trim()).filter(Boolean).join(" ").slice(0, 120)
}

export interface NoteFilter { search: string; color?: NoteColor }
export interface NoteGroups { pinned: Note[]; others: Note[] }

/** Notes matching the search (text, case-insensitive) and colour, newest edit first, pinned split out. */
export function orderNotes(notes: readonly Note[], f: NoteFilter): NoteGroups {
  const needle = f.search.trim().toLowerCase()
  const list = notes
    .filter((n) => (!needle || n.text.toLowerCase().includes(needle)) && (!f.color || colorOf(n.color) === f.color))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { pinned: list.filter((n) => n.pinned), others: list.filter((n) => !n.pinned) }
}

/** How many notes each colour has, for the filter chips. */
export function colorCounts(notes: readonly Note[]): Record<NoteColor, number> {
  const counts: Record<NoteColor, number> = { plain: 0, amber: 0, teal: 0, rose: 0, blue: 0 }
  for (const n of notes) counts[colorOf(n.color)]++
  return counts
}

/** "now", "5m", "3h", "2d", "1w"; empty for a time that can't be read. */
export function shortAgo(iso: string, now: Date): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ""
  const m = Math.max(0, Math.floor((now.getTime() - then) / 60_000))
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  if (m < 60 * 24) return `${Math.floor(m / 60)}h`
  if (m < 60 * 24 * 7) return `${Math.floor(m / 1440)}d`
  return `${Math.floor(m / 10080)}w`
}

export interface CourseOption { id: string; label: string; title: string }

/** The web's course label: the course code, else the initials of the first three words of the title. */
export const courseLabel = (c: Pick<Courses[number], "code" | "title">): string =>
  c.code.trim() || c.title.trim().split(/\s+/).slice(0, 3).map((w) => w[0]).join("").toUpperCase()

export const courseOptions = (courses: Courses): CourseOption[] => courses.map((c) => ({ id: c.id, label: courseLabel(c), title: c.title }))

export const courseFor = (courses: Courses, id: string | undefined): CourseOption | undefined => courseOptions(courses).find((c) => c.id === id)
