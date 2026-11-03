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

/** Overlapping calendar items get separate lanes; an event never hides another. */
export function timedLanes(tasks: Task[], date: string) {
  const items = tasks.filter((task) => { const slot = taskSlot(task); return slot.date === date && !!slot.time })
    .map((task) => {
      const start = minuteOfDay(taskSlot(task).time!)
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

export function reflectionSummary(task: Task) {
  return [task.reflection?.text, ...Object.values(task.reflection?.items ?? {})].filter(Boolean).join(" · ")
}
