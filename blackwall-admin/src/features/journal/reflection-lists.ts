import type { JournalEntry, JournalLogItem, Task, TaskReflection } from "../../lib/types.ts"

export interface LearningEntry { day: string; item: JournalLogItem }

/** Journal entries written as learning reflections: linked to a course and/or a task. Newest first. Optionally only those about one course or task. */
export function learningReflections(journal: readonly JournalEntry[], tasks: readonly Task[], filter: { courseId?: string; taskId?: string } = {}): LearningEntry[] {
  return journal
    .flatMap((day) => (day.entries ?? []).filter((item) => (item.courseId || item.taskId) && (!filter.taskId || item.taskId === filter.taskId) && (!filter.courseId || item.courseId === filter.courseId || tasks.some((t) => t.id === item.taskId && t.courseId === filter.courseId))).map((item) => ({ day: day.id, item })))
    .sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt))
}

export interface AttachedReview { id: string; kind: "Task" | "Event" | "Log"; source: string; day: string; reflection: TaskReflection }

/** Reflections attached to tasks, events and plain log entries (not check-ins, not learning reflections), most recently written first. */
export function attachedReflections(tasks: readonly Task[], journal: readonly JournalEntry[]): AttachedReview[] {
  const fromTasks: AttachedReview[] = tasks.flatMap((task) => task.reflection ? [{ id: `task/${task.id}`, kind: task.kind === "event" ? "Event" as const : "Task" as const, source: task.title, day: (task.scheduledDate ?? task.due ?? task.reflection.updatedAt).slice(0, 10), reflection: task.reflection }] : [])
  const fromLogs: AttachedReview[] = journal.flatMap((day) => (day.entries ?? []).flatMap((item) => item.reflection && !item.id.startsWith("journal-") && !item.courseId && !item.taskId ? [{ id: `log/${day.id}/${item.id}`, kind: "Log" as const, source: item.text, day: day.id, reflection: item.reflection }] : []))
  return [...fromTasks, ...fromLogs].sort((a, b) => b.reflection.updatedAt.localeCompare(a.reflection.updatedAt))
}
