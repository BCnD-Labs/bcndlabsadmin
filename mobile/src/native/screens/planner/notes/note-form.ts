/**
 * Pure rules for the note editor. Fields are exactly the ones the web's note form saves (text, colour,
 * pinned, course). Editing builds a patch of only those fields, so everything else on a note (its links,
 * anything a newer version added) is left alone. `links` are shown read-only.
 */
import type { NewNote } from "../../../../lib/shared.ts"
import type { Note, NoteColor } from "./note-rules.ts"

export interface NoteDraft { text: string; color: NoteColor; pinned: boolean; courseId?: string }

/** A new note starts yellow and unpinned, like the web's. */
export const emptyNoteDraft = (): NoteDraft => ({ text: "", color: "amber", pinned: false })

export const draftFromNote = (n: Note): NoteDraft => ({ text: n.text, color: n.color, pinned: n.pinned, courseId: n.courseId })

/** Why a draft can't be saved yet (the web needs some text). */
export function noteErrors(d: NoteDraft): { text?: string } {
  return d.text.trim() ? {} : { text: "Write something first." }
}

export const noteDirty = (a: NoteDraft, b: NoteDraft): boolean => a.text !== b.text || a.color !== b.color || a.pinned !== b.pinned || a.courseId !== b.courseId

/** A new note: no course key at all when none is chosen. */
export function buildNewNote(d: NoteDraft): NewNote {
  return { text: d.text, color: d.color, pinned: d.pinned, ...(d.courseId && { courseId: d.courseId }) }
}

/** The patch for an edit: a cleared course is an explicit undefined so it really clears. */
export function buildNotePatch(d: NoteDraft): Partial<NewNote> {
  return { text: d.text, color: d.color, pinned: d.pinned, courseId: d.courseId || undefined }
}
