/**
 * Which tasks the Planner calendar shows where (pure: no React, no clock). This is the web's rule
 * (blackwall-admin/src/features/productivity/planner-utils.ts, which pulls in app stores and so
 * cannot be imported here), written against the shared task type and date keys:
 *  - a task sits on its scheduled slot (`scheduledDate` + `scheduledTime`) when it has one, else on
 *    its due date and due time;
 *  - it also shows on its due date when that differs from the slot (as a deadline);
 *  - an unscheduled "due at 23:45 or later" time means "by end of day", never a start time.
 * Only real tasks are ever listed.
 */
import { isOverdue, type Collections } from "../../../../lib/shared.ts"

export type Task = Collections["tasks"][number]
type Courses = Collections["courses"]
type Journal = Collections["journal"]

/** Same pattern the server accepts for `scheduledTime` (shared/planner.ts). */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
export const validTime = (value: unknown): value is string => typeof value === "string" && TIME.test(value)

/** Where the task sits: its schedule when it has one, otherwise its due date and time. */
export function taskSlot(task: Task): { date?: string; time?: string } {
  const time = task.scheduledDate ? task.scheduledTime : task.time
  return { date: task.scheduledDate ?? task.due, time: validTime(time) ? time : undefined }
}

/** On the day by its slot or by its deadline. */
export function taskOnDate(task: Task, date: string): boolean {
  return taskSlot(task).date === date || task.due === date
}

export const END_OF_DAY = "23:45"
export const isEndOfDay = (time?: string) => !!time && time >= END_OF_DAY

/** The real start time shown on `date`; none for deadlines, all-day and end-of-day items. */
export function startTimeOn(task: Task, date: string): string | undefined {
  const slot = taskSlot(task)
  if (slot.date !== date || !slot.time) return undefined
  if (!task.scheduledDate && isEndOfDay(slot.time)) return undefined
  return slot.time
}

/** Due on `date` without a real start time there: shown as a deadline. */
export const isDeadlineOn = (task: Task, date: string) => task.due === date && !startTimeOn(task, date)

export const minuteOfDay = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** The all-day / due row of a day: everything on it that has no real start time there. */
export function allDayOn(tasks: readonly Task[], date: string): Task[] {
  return tasks.filter((t) => taskOnDate(t, date) && !startTimeOn(t, date))
}

export interface Lane { task: Task; start: number; end: number; lane: number; lanes: number }

/** Timed items of a day. Overlapping ones get separate lanes, so an item never hides another (same algorithm as the web). */
export function timedLanes(tasks: readonly Task[], date: string): Lane[] {
  const items: Lane[] = tasks
    .filter((t) => startTimeOn(t, date))
    .map((task) => {
      const start = minuteOfDay(startTimeOn(task, date)!)
      return { task, start, end: Math.min(1440, start + (task.durationMinutes ?? 60)), lane: 0, lanes: 1 }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end || a.task.id.localeCompare(b.task.id))
  let group: Lane[] = []
  let ends: number[] = []
  const finish = () => {
    for (const item of group) item.lanes = ends.length
    group = []
    ends = []
  }
  for (const item of items) {
    if (group.length && ends.every((end) => end <= item.start)) finish()
    const free = ends.findIndex((end) => end <= item.start)
    item.lane = free < 0 ? ends.length : free
    ends[item.lane] = item.end
    group.push(item)
  }
  finish()
  return items
}

/** Tasks per day for the given days, in one pass (a task due and scheduled on different days appears on both). */
export function tasksByDay(tasks: readonly Task[], days: readonly string[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>(days.map((d) => [d, []]))
  for (const t of tasks) {
    const own = taskSlot(t).date
    map.get(own ?? "")?.push(t)
    if (t.due && t.due !== own) map.get(t.due)?.push(t)
  }
  return map
}

/** A cell with little room shows up to `max` rows: every item when they fit, else `max - 1` items and "+N more". */
export function chipOverflow<T>(items: readonly T[], max = 3): { shown: T[]; more: number } {
  if (items.length <= max) return { shown: [...items], more: 0 }
  const shown = items.slice(0, Math.max(0, max - 1))
  return { shown, more: items.length - shown.length }
}

export type DayDot = "done" | "overdue" | "open"
/** Narrow month cells: one dot per item (done / overdue / open), at most `max`, then a count of the rest. */
export function dayDots(tasks: readonly Task[], today: string, max = 3): { dots: DayDot[]; more: number } {
  const kinds = tasks.map((t): DayDot => (t.done ? "done" : t.due && t.due < today ? "overdue" : "open"))
  return { dots: kinds.slice(0, max), more: Math.max(0, kinds.length - max) }
}

/** One agenda line for a day. `time` is HH:mm, set only for a real start time. */
export interface AgendaItem { event?: boolean; id: string; title: string; done: boolean; time?: string; deadline: boolean; overdue: boolean; course?: string; duration?: number }

/** A day's items: timed ones by start time first, then the rest in creation order. */
export function agendaItems(tasks: readonly Task[], date: string, today: string, courses: Courses): AgendaItem[] {
  return tasks
    .filter((t) => taskOnDate(t, date))
    .sort((a, b) => (startTimeOn(a, date) ?? "99:99").localeCompare(startTimeOn(b, date) ?? "99:99") || a.createdAt.localeCompare(b.createdAt))
    .map((t) => {
      const course = t.courseId ? courses.find((c) => c.id === t.courseId) : undefined
      const time = startTimeOn(t, date)
      return { ...(t.kind === "event" && { event: true }), id: t.id, title: t.title, done: t.done, time, deadline: isDeadlineOn(t, date), overdue: isOverdue(t, today), course: course ? course.title || course.code : undefined, duration: time ? t.durationMinutes : undefined }
    })
}

/** The phone-local YYYY-MM-DD of a stored timestamp (the web counts completions the same way). */
export function localKeyOf(timestamp: string): string | undefined {
  const d = new Date(timestamp)
  return Number.isNaN(d.getTime()) ? undefined : `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** What the day's header notes beside the item count: a written daily log and tasks completed that day. */
export function dayMeta(tasks: readonly Task[], journal: Journal, date: string): { logged: boolean; completed: number } {
  return {
    logged: journal.some((j) => j.id === date && (j.text.trim() !== "" || (j.sections ?? []).some(s => !!s.text.trim()) || (j.entries ?? []).some(e => !e.courseId && !e.taskId && !!e.text.trim()))),
    completed: tasks.filter((t) => t.kind !== "event" && t.done && !!t.completedAt && localKeyOf(t.completedAt) === date).length,
  }
}
