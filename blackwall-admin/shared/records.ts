/**
 * Pure record rules for tasks, notes and the daily log (journal), shared by the web store and the
 * native apps. Every function takes a Collections-like object (only the keys it needs) and returns a
 * NEW object; inputs are never mutated. No browser, zustand or framework APIs live here.
 * The rules are the ones the web store has always had: keep them in step with it, not ahead of it.
 */
import { validJournalItems, validJournalSections } from "./journal-sections.ts"
import type { Course, JournalSection, JournalLogItem, JournalEntry, Note, Service, Subtask, Task, WorkStatus } from "../src/lib/types.ts"
import type { Collections } from "./workspace.ts"

export interface RecordOptions {
  /** Builds an id from a prefix, e.g. `tsk` -> `tsk_ab12cd34`. Inject a fixed one in tests. */
  makeId?: (prefix: string) => string
  /** ISO timestamp for "now". Inject a fixed one in tests. */
  now?: () => string
}
export type NewTask = Omit<Task, "id" | "createdAt" | "updatedAt">
export type NewNote = Omit<Note, "id" | "createdAt" | "updatedAt">
export type NewCourse = Omit<Course, "id" | "createdAt" | "updatedAt">
export type NewService = Omit<Service, "id" | "createdAt" | "updatedAt">
export const TASK_ID_PREFIX = "tsk"
export const NOTE_ID_PREFIX = "nte"

type TaskData = Pick<Collections, "tasks">
type NoteData = Pick<Collections, "notes">
type JournalData = Pick<Collections, "journal">
type CourseData = Pick<Collections, "courses">
type ServiceData = Pick<Collections, "services">

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

/** Flips `done`: completing stamps `completedAt`, reopening clears it. A task that tracks a status follows: done means submitted. */
export function toggleTask<T extends TaskData>(data: T, id: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return {
    ...data,
    tasks: data.tasks.map((task) => {
      if (task.id !== id || task.kind === "event") return task
      const status: Partial<Task> = task.status ? { status: task.done ? "in_progress" : task.status === "graded" ? "graded" : "submitted" } : {}
      return { ...task, ...status, done: !task.done, completedAt: task.done ? undefined : t, updatedAt: t }
    }),
  }
}

/** Moves coursework through not started, in progress, submitted and graded. Submitted and graded mean done. */
export function setTaskStatus<T extends TaskData>(data: T, id: string, status: WorkStatus, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  const done = status === "submitted" || status === "graded"
  return {
    ...data,
    tasks: data.tasks.map((task) => {
      if (task.id !== id || task.kind === "event") return task
      return { ...task, status, done, completedAt: done ? (task.done && task.completedAt ? task.completedAt : t) : undefined, updatedAt: t }
    }),
  }
}

/** Puts each proposed task on its suggested focus day, in one edit. Tasks that no longer exist are skipped. */
export function applyFocusPlan<T extends TaskData>(data: T, plan: { id: string; date: string }[], opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  const days = new Map(plan.map((p) => [p.id, p.date]))
  return { ...data, tasks: data.tasks.map((task) => (days.has(task.id) && !task.done ? { ...task, focusDate: days.get(task.id), updatedAt: t } : task)) }
}

const SUBTASK_ID_PREFIX = "sub"
type NewStep = { title: string; date?: string; topicId?: string }

/** Adds steps to a task in one edit. Blank titles are skipped; the list is capped (100) like the validator. */
export function addSubtasks<T extends TaskData>(data: T, taskId: string, steps: NewStep[], opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  const make = opts.makeId ?? defaultMakeId
  const fresh: Subtask[] = steps.filter((s) => s.title.trim()).map((s) => ({ id: make(SUBTASK_ID_PREFIX), title: s.title.trim().slice(0, 300), done: false, ...(s.date ? { date: s.date } : {}), ...(s.topicId ? { topicId: s.topicId } : {}) }))
  if (!fresh.length) return data
  return { ...data, tasks: data.tasks.map((task) => (task.id === taskId && (task.subtasks?.length ?? 0) + fresh.length <= 100 ? { ...task, subtasks: [...(task.subtasks ?? []), ...fresh], updatedAt: t } : task)) }
}

/** Edits one step. Finishing the first step of unstarted coursework moves it to "in progress". */
export function updateSubtask<T extends TaskData>(data: T, taskId: string, stepId: string, patch: Partial<Omit<Subtask, "id">>, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return {
    ...data,
    tasks: data.tasks.map((task) => {
      if (task.id !== taskId || !task.subtasks?.some((s) => s.id === stepId)) return task
      const subtasks = task.subtasks.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
      const begins = patch.done === true && !task.done && !!task.courseId && (!task.status || task.status === "not_started")
      return { ...task, subtasks, ...(begins ? { status: "in_progress" as const } : {}), updatedAt: t }
    }),
  }
}

export function toggleSubtask<T extends TaskData>(data: T, taskId: string, stepId: string, opts: RecordOptions = {}): T {
  const step = data.tasks.find((task) => task.id === taskId)?.subtasks?.find((s) => s.id === stepId)
  return step ? updateSubtask(data, taskId, stepId, { done: !step.done }, opts) : data
}

export function removeSubtask<T extends TaskData>(data: T, taskId: string, stepId: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return { ...data, tasks: data.tasks.map((task) => (task.id === taskId && task.subtasks ? { ...task, subtasks: task.subtasks.filter((s) => s.id !== stepId), updatedAt: t } : task)) }
}

/** Removes a course module and unlinks it from the course's work and notes, rather than deleting them. */
export function removeCourseTopic<T extends TaskData & Pick<Collections, "courses"> & Partial<Pick<Collections, "notes">>>(data: T, courseId: string, topicId: string, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return {
    ...data,
    courses: data.courses.map((c) => (c.id === courseId ? { ...c, topics: (c.topics ?? []).filter((x) => x.id !== topicId), updatedAt: t } : c)),
    tasks: data.tasks.map((task) => task.courseId === courseId && (task.topicIds?.includes(topicId) || task.subtasks?.some((s) => s.topicId === topicId))
      ? { ...task, topicIds: task.topicIds?.filter((x) => x !== topicId), subtasks: task.subtasks?.map((s) => (s.topicId === topicId ? { ...s, topicId: undefined } : s)), updatedAt: t } : task),
    ...(data.notes ? { notes: data.notes.map((n) => (n.courseId === courseId && n.topicIds?.includes(topicId) ? { ...n, topicIds: n.topicIds.filter((x) => x !== topicId), updatedAt: t } : n)) } : {}),
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

/** Learning records use the same local-first workspace path as tasks and notes. */
export function createCourse<T extends CourseData>(data: T, input: NewCourse, opts: RecordOptions = {}): { data: T; record: Course } {
  const t = (opts.now ?? defaultNow)()
  const record: Course = { ...input, id: (opts.makeId ?? defaultMakeId)("crs"), createdAt: t, updatedAt: t }
  return { data: { ...data, courses: [record, ...data.courses] }, record }
}

export function updateCourse<T extends CourseData>(data: T, id: string, patch: Partial<NewCourse>, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return { ...data, courses: data.courses.map((course) => course.id === id ? { ...course, ...patch, updatedAt: t } : course) }
}

/** Mikoshi tool records use the same guarded workspace save path on every client. */
export function createService<T extends ServiceData>(data: T, input: NewService, opts: RecordOptions = {}): { data: T; record: Service } {
  const t = (opts.now ?? defaultNow)()
  const record: Service = { ...input, id: (opts.makeId ?? defaultMakeId)("svc"), createdAt: t, updatedAt: t }
  return { data: { ...data, services: [record, ...data.services] }, record }
}

export function updateService<T extends ServiceData>(data: T, id: string, patch: Partial<NewService>, opts: RecordOptions = {}): T {
  const t = (opts.now ?? defaultNow)()
  return { ...data, services: data.services.map((service) => service.id === id ? { ...service, ...patch, updatedAt: t } : service) }
}

export function removeService<T extends ServiceData>(data: T, id: string): T {
  return { ...data, services: data.services.filter((service) => service.id !== id) }
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
  const item: JournalLogItem = { ...input, createdAt: previous?.createdAt ?? input.createdAt, updatedAt: t, noteId: asNote ? noteId : previous?.noteId ?? input.noteId, courseId: Object.hasOwn(input, "courseId") ? input.courseId : previous?.courseId, taskId: Object.hasOwn(input, "taskId") ? input.taskId : previous?.taskId }
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
