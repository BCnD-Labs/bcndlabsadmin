import { daysBetween } from "../../../lib/shared.ts"
import type { Collections } from "../../../lib/shared.ts"

export type Course = Collections["courses"][number]
export type Task = Collections["tasks"][number]
export type Kind = NonNullable<Course["kind"]>

export const KINDS: { value: Kind; label: string; tint: string }[] = [
  { value: "course", label: "Course", tint: "#64b5f6" },
  { value: "certification", label: "Certification", tint: "#81c784" },
  { value: "selfpaced", label: "Self-paced", tint: "#4db6ac" },
  { value: "skill", label: "Skill", tint: "#b39ddb" },
  { value: "reading", label: "Reading", tint: "#ffb74d" },
]

export const kindInfo = (course: Course) => KINDS.find(k => k.value === (course.kind ?? "course")) ?? KINDS[0]

export function learningProgress(course: Course, items: Task[]) {
  const kind = course.kind ?? "course"
  const counted = items.filter(t => t.kind !== "event" && t.learningType !== "event")
  const measured = kind === "certification" || kind === "selfpaced" || kind === "reading"
    ? counted.filter(t => t.learningType === "milestone") : counted
  const basis = kind === "certification" || kind === "selfpaced" || kind === "reading" ? measured : counted
  const done = basis.filter(t => t.done).length
  const scores = kind === "certification" ? items.filter(t => t.learningType === "exam" && typeof t.score === "number").map(t => t.score!) : []
  if (kind === "reading" && course.pagesTotal) {
    const read = Math.min(course.pagesRead ?? 0, course.pagesTotal)
    return { value: read / course.pagesTotal, label: `p. ${read} of ${course.pagesTotal}`, measured: true, best: undefined as number | undefined }
  }
  const noun = measured.length && kind === "certification" ? "exam domains" : measured.length && kind === "selfpaced" ? "sections" : measured.length && kind === "reading" ? "chapters" : "tasks"
  const label = basis.length ? `${done} of ${basis.length} ${noun}` : kind === "skill" ? "Add a milestone to track progress" : `No ${kind === "reading" ? "chapters" : kind === "certification" ? "exam domains" : "tasks"} yet`
  return { value: basis.length ? done / basis.length : 0, label, measured: basis.length > 0, best: scores.length ? Math.max(...scores) : undefined }
}

export function dueGroup(due: string, today: string): "Overdue" | "Next 7 days" | "Later" {
  const days = daysBetween(due, today)
  return days < 0 ? "Overdue" : days <= 7 ? "Next 7 days" : "Later"
}

export function upcomingLearning(courses: Course[], tasks: Task[], today: string) {
  const known = new Set(courses.map(c => c.id))
  const event = (task: Task) => task.kind === "event" || task.learningType === "event"
  const rows: { id: string; courseId: string; title: string; due: string; type: Task["learningType"]; time?: string; occasion?: "due" | "planned" | "event"; task?: Task }[] = tasks.filter(t => t.courseId && known.has(t.courseId) && !t.done && !event(t) && !!t.due)
    .map(t => ({ id: t.id, courseId: t.courseId!, title: t.title, due: t.due!, type: t.learningType ?? (t.kind === "event" ? "event" : "assignment"), task: t }))
  for (const task of tasks.filter(t => t.courseId && known.has(t.courseId) && !t.done && !!(t.scheduledDate ?? (event(t) ? t.due : undefined)) && (t.scheduledDate ?? t.due!) >= today)) {
    // Planned work is shown as well as its deadline when they fall on different dates.
    if (!event(task) && task.scheduledDate === task.due) continue
    rows.push({ id: `planned-${task.id}`, courseId: task.courseId!, title: task.title, due: task.scheduledDate ?? task.due!, time: task.scheduledTime, type: task.learningType, occasion: task.kind === "event" || task.learningType === "event" ? "event" : "planned", task })
  }
  for (const c of courses) if (c.kind === "certification" && c.endDate && c.endDate >= today) {
    rows.push({ id: `exam-${c.id}`, courseId: c.id, title: `${c.title} exam date`, due: c.endDate, type: "exam" })
  }
  return rows.sort((a, b) => a.due.localeCompare(b.due) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.title.localeCompare(b.title))
}


/** Daily planning uses actual scheduled records; free-form course schedules are never fabricated. */
export function learningToday(courses: Course[], tasks: Task[], today: string) {
  const known = new Set(courses.map(course => course.id))
  const active = tasks.filter(task => task.courseId && known.has(task.courseId) && !task.done)
  return {
    schedule: active.filter(task => (task.scheduledDate ?? (task.kind === "event" || task.learningType === "event" ? task.due : undefined)) === today).sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99") || a.title.localeCompare(b.title)),
    overdue: active.filter(task => task.kind !== "event" && task.learningType !== "event" && task.due && task.due < today),
    due: active.filter(task => task.kind !== "event" && task.learningType !== "event" && task.due === today),
    exams: courses.filter(course => course.kind === "certification" && course.endDate === today),
  }
}
