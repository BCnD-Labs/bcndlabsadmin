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
  const rows: { id: string; courseId: string; title: string; due: string; type: Task["learningType"]; task?: Task }[] = tasks.filter(t => t.courseId && known.has(t.courseId) && !t.done && !!t.due)
    .map(t => ({ id: t.id, courseId: t.courseId!, title: t.title, due: t.due!, type: t.learningType ?? (t.kind === "event" ? "event" : "assignment"), task: t }))
  for (const c of courses) if (c.kind === "certification" && c.endDate && c.endDate >= today) {
    rows.push({ id: `exam-${c.id}`, courseId: c.id, title: `${c.title} exam date`, due: c.endDate, type: "exam" })
  }
  return rows.sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title))
}
