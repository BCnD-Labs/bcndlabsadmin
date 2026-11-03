/**
 * Pure record rules for tasks, notes and the daily log (journal), shared by the web store and the
 * native apps. Every function takes a Collections-like object (only the keys it needs) and returns a
 * NEW object; inputs are never mutated. No browser, zustand or framework APIs live here.
 * The rules are the ones the web store has always had: keep them in step with it, not ahead of it.
 */
import type { JournalEntry, Note, Task } from "../src/lib/types.ts"
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
    tasks: data.tasks.map((task) => (task.id === id ? { ...task, done: !task.done, completedAt: task.done ? undefined : t, updatedAt: t } : task)),
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

/** Upsert the log for a day (its id is the date); text that is empty after trimming deletes it. */
export function saveJournal<T extends JournalData>(data: T, date: string, text: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  if (!text.trim()) return { ...data, journal: data.journal.filter((entry) => entry.id !== date) }
  if (data.journal.some((entry) => entry.id === date)) {
    return { ...data, journal: data.journal.map((entry) => (entry.id === date ? { ...entry, text, updatedAt: t } : entry)) }
  }
  const entry: JournalEntry = { id: date, text, createdAt: t, updatedAt: t }
  return { ...data, journal: [...data.journal, entry] }
}

/** Move a day's log to another date, appending (blank line between) if that day already has one. */
export function moveJournal<T extends JournalData>(data: T, from: string, to: string, opts: RecordOptions = {}): T {
  if (from === to) return data
  const src = data.journal.find((entry) => entry.id === from)
  if (!src) return data
  const dest = data.journal.find((entry) => entry.id === to)
  return saveJournal(saveJournal(data, to, dest ? `${dest.text}\n\n${src.text}` : src.text, opts), from, "", opts)
}
