/**
 * Pure record rules for tasks, notes and the daily log (journal), shared by the web store and the
 * native apps. Every function takes a Collections-like object (only the keys it needs) and returns a
 * NEW object; inputs are never mutated. No browser, zustand or framework APIs live here.
 * The rules are the ones the web store has always had: keep them in step with it, not ahead of it.
 */
import { validJournalItems, validJournalSections } from "./journal-sections.ts"
import type { JournalSection, JournalLogItem, JournalEntry, Note, Task } from "../src/lib/types.ts"
import type { Collections } from "./workspace.ts"

export interface RecordOptions {
  /** Builds an id from a prefix, e.g. `tsk` -> `tsk_ab12cd34`. Inject a fixed one in tests. */
  makeId?: (prefix: string) => string
  /** ISO timestamp for "now". Inject a fixed one in tests. */
  now?: () => string
}
export type NewTask = Omit<Task, "id" | "createdAt" | "updatedAt">
export type NewNote = Omit<Note, "id" | "createdAt" | "updatedAt">
export const TASK_ID_PREFIX = "tsk"
export const NOTE_ID_PREFIX = "nte"

type TaskData = Pick<Collections, "tasks">
type NoteData = Pick<Collections, "notes">
type JournalData = Pick<Collections, "journal">

export function defaultMakeId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rand}`
}
const defaultNow = () => new Date().toISOString()

/** New records go to the front of the list. */
export function createTask<T extends TaskData>(data: T, input: NewTask, opts: RecordOptions = {}): { data: T; record: Task } {
  const t = (opts.now ?? defaultNow)()
  const record: Task = { ...input, id: (opts.makeId ?? defaultMakeId)(TASK_ID_PREFIX), createdAt: t, updatedAt: t }
  return { data: { ...data, tasks: [record, ...data.tasks] }, record }
}

/** Merges the patch into the matching task and stamps `updatedAt`. An unknown id changes nothing. */
export function updateTask<T extends TaskData>(data: T, id: string, patch: Partial<NewTask>, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return { ...data, tasks: data.tasks.map((task) => (task.id === id ? { ...task, ...patch, updatedAt: t } : task)) }
}

/** Deleting a task deletes only that task; nothing else links to it by cascade. */
export function removeTask<T extends TaskData>(data: T, id: string): T {
  return { ...data, tasks: data.tasks.filter((task) => task.id !== id) }
}

/** Flips `done`: completing stamps `completedAt`, reopening clears it. */
export function toggleTask<T extends TaskData>(data: T, id: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return {
    ...data,
    tasks: data.tasks.map((task) => (task.id === id && task.kind !== "event" ? { ...task, done: !task.done, completedAt: task.done ? undefined : t, updatedAt: t } : task)),
  }
}

export function toggleStar<T extends TaskData>(data: T, id: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return { ...data, tasks: data.tasks.map((task) => (task.id === id ? { ...task, starred: !task.starred, updatedAt: t } : task)) }
}

export function createNote<T extends NoteData>(data: T, input: NewNote, opts: RecordOptions = {}): { data: T; record: Note } {
  const t = (opts.now ?? defaultNow)()
  const record: Note = { ...input, id: (opts.makeId ?? defaultMakeId)(NOTE_ID_PREFIX), createdAt: t, updatedAt: t }
  return { data: { ...data, notes: [record, ...data.notes] }, record }
}

export function updateNote<T extends NoteData>(data: T, id: string, patch: Partial<NewNote>, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return { ...data, notes: data.notes.map((note) => (note.id === id ? { ...note, ...patch, updatedAt: t } : note)) }
}

/** Deleting a note deletes only that note. */
export function removeNote<T extends NoteData>(data: T, id: string): T {
  return { ...data, notes: data.notes.filter((note) => note.id !== id) }
}

export function togglePin<T extends NoteData>(data: T, id: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return { ...data, notes: data.notes.map((note) => (note.id === id ? { ...note, pinned: !note.pinned, updatedAt: t } : note)) }
}

/**
 * Deleting a course deletes its coursework (it only means something with the course) and unlinks,
 * rather than deletes, its notes. The course row itself is removed by the caller.
 */
export function removeCourseRecords<T extends TaskData & NoteData>(data: T, courseId: string): T {
  return {
    ...data,
    tasks: data.tasks.filter((task) => task.courseId !== courseId),
    notes: data.notes.map((note) => (note.courseId === courseId ? { ...note, courseId: undefined } : note)),
  }
}

/** Upsert main log text; blank text deletes only entries without explicitly added sections. */
export function saveJournal<T extends JournalData>(data: T, date: string, text: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  if (!text.trim() && !data.journal.find((entry) => entry.id === date)?.sections?.length && !data.journal.find((entry) => entry.id === date)?.entries?.length) return { ...data, journal: data.journal.filter((entry) => entry.id !== date) }
  if (data.journal.some((entry) => entry.id === date)) {
    return { ...data, journal: data.journal.map((entry) => (entry.id === date ? { ...entry, text, updatedAt: t } : entry)) }
  }
  const entry: JournalEntry = { id: date, text, createdAt: t, updatedAt: t }
  return { ...data, journal: [...data.journal, entry] }
}

/** Update only this day's explicitly added sections, preserving its main text. */
export function saveJournalSections<T extends JournalData>(data: T, date: string, sections: JournalSection[], opts: RecordOptions = {}): T {
  if (!validJournalSections(sections)) return data
  if (!validJournalItems(data.journal.find((entry) => entry.id === date)?.entries ?? [], sections)) return data
  const t = (opts.now ?? defaultNow)()
  const existing = data.journal.find((entry) => entry.id === date)
  if (!sections.length && !existing?.text.trim() && !existing?.entries?.length) return { ...data, journal: data.journal.filter((entry) => entry.id !== date) }
  const entry: JournalEntry = { id: date, text: "", createdAt: t, ...existing, sections: sections.map((section) => { const noteId = section.noteId ?? existing?.sections?.find((value) => value.id === section.id)?.noteId; return noteId ? { ...section, noteId } : { ...section } }), updatedAt: t }
  return { ...data, journal: existing ? data.journal.map((value) => value.id === date ? entry : value) : [...data.journal, entry] }
}

/** A stable item id makes retries idempotent; text and optional Note save in one workspace edit. */
export function saveJournalItem<T extends JournalData & NoteData>(data: T, date: string, input: JournalLogItem, asNote = false, opts: RecordOptions = {}): T {
  const existing = data.journal.find((entry) => entry.id === date)
  if (!input.text.trim() || !validJournalItems([input], existing?.sections ?? [])) return data
  const previous = existing?.entries?.find((entry) => entry.id === input.id)
  const t = (opts.now ?? defaultNow)()
  const noteId = previous?.noteId ?? input.noteId ?? `nte_log_${input.id.slice(0, 90)}`
  let next = data
  if (asNote) next = data.notes.some((note) => note.id === noteId) ? updateNote(data, noteId, { text: input.text }, opts) : createNote(data, { text: input.text, color: "plain", pinned: false }, { ...opts, makeId: () => noteId }).data
  const item: JournalLogItem = { ...input, createdAt: previous?.createdAt ?? input.createdAt, updatedAt: t, noteId: asNote ? noteId : previous?.noteId ?? input.noteId }
  const entries = previous ? existing!.entries!.map((entry) => entry.id === item.id ? item : entry) : [...(existing?.entries ?? []), item]
  if (!validJournalItems(entries, existing?.sections ?? [])) return data
  const row: JournalEntry = { id: date, text: "", createdAt: t, ...existing, entries, updatedAt: t }
  return { ...next, journal: existing ? next.journal.map((entry) => entry.id === date ? row : entry) : [...next.journal, row] }
}

/** Edit legacy main/section text in place, preserving the old representation and all newer items. */
export function saveJournalLegacyText<T extends JournalData & NoteData>(data: T, date: string, sectionId: string | undefined, text: string, asNote: boolean, stableNoteId: string, opts: RecordOptions = {}): T {
  const existing = data.journal.find((entry) => entry.id === date)
  const section = existing?.sections?.find((value) => value.id === sectionId)
  if (sectionId && !section) return data
  const noteId = section ? section.noteId ?? stableNoteId : existing?.mainNoteId ?? stableNoteId
  let next = section ? saveJournalSections(data, date, existing!.sections!.map((value) => value.id === sectionId ? { ...value, text, noteId: asNote ? noteId : value.noteId } : value), opts) : saveJournal(data, date, text, opts)
  if (!asNote) return next
  next = next.notes.some((note) => note.id === noteId) ? updateNote(next, noteId, { text }, opts) : createNote(next, { text, color: "plain", pinned: false }, { ...opts, makeId: () => noteId }).data
  if (!section) next = { ...next, journal: next.journal.map((entry) => entry.id === date ? { ...entry, mainNoteId: noteId } : entry) }
  return next
}

/** Move a log without dropping section text; colliding tabs are kept as named Markdown sections. */
export function moveJournal<T extends JournalData>(data: T, from: string, to: string, opts: RecordOptions = {}): T {
  if (from === to) return data
  const src = data.journal.find((entry) => entry.id === from)
  if (!src) return data
  const dest = data.journal.find((entry) => entry.id === to)
  const t = (opts.now ?? defaultNow)()
  const sourceText = [src.text, ...(dest ? (src.sections ?? []).map((section) => `## ${section.title}\n${section.text}`) : [])].filter(Boolean).join("\n\n")
  const usedIds = new Set(dest?.entries?.map((entry) => entry.id))
  const entries = [...(dest?.entries ?? []), ...(src.entries ?? []).map((entry) => {
    const id = usedIds.has(entry.id) ? (opts.makeId ?? defaultMakeId)("log") : entry.id
    usedIds.add(id)
    return dest ? { ...entry, id, sectionId: undefined } : entry
  })]
  const moved: JournalEntry = dest ? { ...dest, text: [dest.text, sourceText].filter(Boolean).join("\n\n"), updatedAt: t } : { ...src, id: to, updatedAt: t }
  if (entries.length) moved.entries = entries
  return { ...data, journal: [...data.journal.filter((entry) => entry.id !== from && entry.id !== to), moved] }
}
