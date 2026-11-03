/**
 * Which tasks the Planner Calendar shows on a day (pure). Same rule as the web
 * (features/productivity/planner-utils.ts): a task sits on its separate schedule when it has one
 * (`scheduledDate` + `scheduledTime`), otherwise on its due date and due time.
 */
import type { Collections } from "../../../lib/shared.ts"

type Task = Collections["tasks"][number]

export interface AgendaTask { id: string; title: string; done: boolean; time?: string; course?: string }

export function slotOf(task: Task): { date?: string; time?: string } {
  return task.scheduledDate ? { date: task.scheduledDate, time: task.scheduledTime } : { date: task.due, time: task.time }
}

/** The days in `days` that have at least one task (done tasks count, as on the web). */
export function busyDays(tasks: readonly Task[], days: readonly string[]): Set<string> {
  const wanted = new Set(days)
  const busy = new Set<string>()
  for (const t of tasks) {
    const date = slotOf(t).date
    if (date && wanted.has(date)) busy.add(date)
  }
  return busy
}

/** One day's tasks, timed ones first by time, then untimed ones by creation order. */
export function agendaFor(tasks: readonly Task[], day: string, courses: Collections["courses"]): AgendaTask[] {
  return tasks
    .filter((t) => slotOf(t).date === day)
    .sort((a, b) => (slotOf(a).time ?? "99:99").localeCompare(slotOf(b).time ?? "99:99") || a.createdAt.localeCompare(b.createdAt))
    .map((t) => {
      const course = t.courseId ? courses.find((c) => c.id === t.courseId) : undefined
      return { id: t.id, title: t.title, done: t.done, time: slotOf(t).time || undefined, course: course ? course.title || course.code : undefined }
    })
}
