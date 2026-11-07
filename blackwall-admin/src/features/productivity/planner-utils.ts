import type { Task } from "../../lib/types.ts"

/** A scheduled slot never silently changes the task's deadline. Legacy due+time still works. */
export function taskSlot(task: Task) {
  return {
    date: task.scheduledDate ?? task.due,
    time: task.scheduledDate ? task.scheduledTime : task.time,
  }
}

export function taskOnDate(task: Task, date: string) {
  return taskSlot(task).date === date || task.due === date
}

export function minuteOfDay(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

/**
 * Overlapping calendar items get separate lanes; an event never hides another. Only items with
 * a real start time on `date` are timed: end-of-day deadlines (23:45+) go to the All-day / Due row.
 */
export function timedLanes(tasks: Task[], date: string) {
  const items = tasks.filter((task) => isTimedOn(task, date))
    .map((task) => {
      const start = minuteOfDay(startTimeOn(task, date)!)
      return { task, start, end: Math.min(1440, start + Math.max(60, task.durationMinutes ?? 60)), lane: 0, lanes: 1 }
    }).sort((a, b) => a.start - b.start || a.end - b.end || a.task.id.localeCompare(b.task.id))
  let group: typeof items = []
  let ends: number[] = []
  const finish = () => { for (const item of group) item.lanes = ends.length; group = []; ends = [] }
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

export { reflectionSummary } from "../../../shared/task-rules.ts"

/**
 * Deadlines entered as "due at 23:55 / 23:59" mean "by the end of the day", not a start time.
 * Only the legacy due-date time can be one; a scheduled slot is always a real start.
 */
export const END_OF_DAY = "23:45"
export function isEndOfDay(time?: string) {
  return !!time && time >= END_OF_DAY
}

/** The start time a calendar item shows on `date`; none for deadlines, all-day and end-of-day items. */
export function startTimeOn(task: Task, date: string) {
  const slot = taskSlot(task)
  if (slot.date !== date || !slot.time) return undefined
  if (!task.scheduledDate && isEndOfDay(slot.time)) return undefined
  return slot.time
}

/** Week/Day view: the item sits in the timed grid on `date` (a scheduled slot or a real due time). */
export function isTimedOn(task: Task, date: string) {
  return !!startTimeOn(task, date)
}

/**
 * Week/Day view: the item sits in the All-day / Due row on `date`. That's an all-day slot, a
 * deadline on a day other than its scheduled one, or an end-of-day due time, as in Month view.
 */
export function isAllDayOn(task: Task, date: string) {
  return taskOnDate(task, date) && !isTimedOn(task, date)
}

/** Due on `date` without a real start time there: shown as a deadline. */
export function isDeadlineOn(task: Task, date: string) {
  return task.due === date && !startTimeOn(task, date)
}

/** Month cells show up to `max` rows: all items when they fit, else `max - 1` items and "+N more". */
export function chipOverflow<T>(items: T[], max = 3) {
  if (items.length <= max) return { shown: items, more: 0 }
  const shown = items.slice(0, Math.max(0, max - 1))
  return { shown, more: items.length - shown.length }
}

export type DayDot = "done" | "overdue" | "open"
/** Narrow month cells: one dot per item (done / overdue / open), at most `max`, then a count of the rest. */
export function dayDots(tasks: Task[], today: string, max = 3) {
  const kinds: DayDot[] = tasks.map((task) => task.done ? "done" : task.due && task.due < today ? "overdue" : "open")
  return { dots: kinds.slice(0, max), more: Math.max(0, kinds.length - max) }
}
