/**
 * How notes, tasks (assignments, quizzes and exams are tasks) and course modules point at each other.
 * The links live in one place on purpose: a task's `recordLinks` says which notes and other tasks it is linked to
 * (and which day logs), and a task's or note's `topicIds` say which course modules it belongs to. Everything else
 * here reads those fields both ways, so a link made from a note shows on the task and the other way round.
 * Pure rules: no React, no clock.
 */
import type { Course, CourseTopic, Note, RecordLink, Task } from "../src/lib/types.ts"
import type { Collections } from "./workspace.ts"

export const MAX_RECORD_LINKS = 50
type Notes = Pick<Collections, "notes">
type Tasks = Pick<Collections, "tasks">

export const noteTitle = (n: Pick<Note, "text">) => n.text.split("\n")[0].trim() || "Untitled note"

export const hasLink = (links: readonly RecordLink[] | undefined, kind: RecordLink["kind"], id: string) => !!links?.some((l) => l.kind === kind && l.id === id)

/** Notes this task links to. */
export const notesOfTask = (data: Notes, task: Pick<Task, "recordLinks">): Note[] => data.notes.filter((n) => hasLink(task.recordLinks, "note", n.id))

/** Tasks that link to this note. */
export const tasksOfNote = (data: Tasks, noteId: string): Task[] => data.tasks.filter((t) => hasLink(t.recordLinks, "note", noteId))

/** Tasks that link to this task (shown as "Linked from"). */
export const tasksLinkingTask = (data: Tasks, taskId: string): Task[] => data.tasks.filter((t) => t.id !== taskId && hasLink(t.recordLinks, "task", taskId))

/** Add or remove one link on a task's list; the list never passes the shared limit. */
export function withLink(links: readonly RecordLink[] | undefined, link: RecordLink, on: boolean): RecordLink[] {
  const rest = (links ?? []).filter((l) => !(l.kind === link.kind && l.id === link.id))
  return on && rest.length < MAX_RECORD_LINKS ? [...rest, link] : rest
}

/** Makes exactly these tasks link to the note (and no others), in one edit. Tasks that don't change are left untouched. */
export function setNoteTaskLinks<T extends Tasks>(data: T, noteId: string, taskIds: readonly string[], now: string): T {
  const want = new Set(taskIds)
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      const has = hasLink(t.recordLinks, "note", noteId)
      if (has === want.has(t.id)) return t
      const next = withLink(t.recordLinks, { kind: "note", id: noteId }, want.has(t.id))
      return { ...t, recordLinks: next.length ? next : undefined, updatedAt: now }
    }),
  }
}

/** The modules of a course a task or note belongs to, in the course's own order. */
export const modulesOf = (course: Pick<Course, "topics"> | undefined, item: { topicIds?: string[] }): CourseTopic[] =>
  (course?.topics ?? []).filter((m) => item.topicIds?.includes(m.id))
