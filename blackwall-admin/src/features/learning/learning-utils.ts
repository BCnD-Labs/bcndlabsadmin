import { BookOpenCheck, CalendarDays, ClipboardList, Flag, type LucideIcon } from "lucide-react"
import { daysUntil, todayKey } from "@/lib/dates"
import type { Course, CourseColor, LearningItemType, Task } from "@/lib/types"

/** Coursework kinds. Every one is a task with `courseId` + `learningType`, so it shares Tasks and the calendar. */
export const LEARNING_TYPES: { value: LearningItemType; label: string; plural: string; icon: LucideIcon; dateLabel: string }[] = [
  { value: "assignment", label: "Assignment", plural: "Assignments", icon: ClipboardList, dateLabel: "Due date" },
  { value: "exam", label: "Exam", plural: "Exams", icon: BookOpenCheck, dateLabel: "Date" },
  { value: "milestone", label: "Milestone", plural: "Milestones", icon: Flag, dateLabel: "Target date" },
  { value: "event", label: "Event", plural: "Events", icon: CalendarDays, dateLabel: "Date" },
]

export const learningType = (t?: LearningItemType) => LEARNING_TYPES.find((x) => x.value === t) ?? LEARNING_TYPES[0]

/** Label colours for courses: names you pick, desaturated for the dark themes. */
export const COURSE_COLORS: { value: CourseColor; label: string; dot: string; bar: string }[] = [
  { value: "blue", label: "Blue", dot: "bg-[#82b1ea]", bar: "bg-[#82b1ea]" },
  { value: "teal", label: "Teal", dot: "bg-[#5fb8aa]", bar: "bg-[#5fb8aa]" },
  { value: "green", label: "Green", dot: "bg-[#7cc79a]", bar: "bg-[#7cc79a]" },
  { value: "amber", label: "Amber", dot: "bg-[#dcb066]", bar: "bg-[#dcb066]" },
  { value: "red", label: "Red", dot: "bg-[#e07a7a]", bar: "bg-[#e07a7a]" },
  { value: "violet", label: "Violet", dot: "bg-[#a994dc]", bar: "bg-[#a994dc]" },
  { value: "slate", label: "Slate", dot: "bg-[#9aa3b0]", bar: "bg-[#9aa3b0]" },
]

export const courseColor = (c?: CourseColor) => COURSE_COLORS.find((x) => x.value === c) ?? COURSE_COLORS[0]

export type CourseStatus = "active" | "upcoming" | "completed"

/** From the dates: not started yet, finished, or in progress (also when no dates are set). */
export function courseStatus(c: Pick<Course, "startDate" | "endDate">, today = todayKey()): CourseStatus {
  if (c.startDate && c.startDate > today) return "upcoming"
  if (c.endDate && c.endDate < today) return "completed"
  return "active"
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = { active: "In progress", upcoming: "Upcoming", completed: "Completed" }

export interface CourseProgress {
  total: number
  done: number
  overdue: number
  /** Open items due in the next 7 days (today included). */
  dueSoon: number
  /** The next open dated item. */
  next?: Task
  pct: number
}

/** Assignments, exams and milestones count toward progress; events don't. */
export function courseProgress(items: Task[]): CourseProgress {
  const counted = items.filter((t) => t.learningType !== "event")
  const done = counted.filter((t) => t.done).length
  const open = items.filter((t) => !t.done && t.due).sort(compareCoursework)
  return {
    total: counted.length,
    done,
    overdue: open.filter((t) => daysUntil(t.due!) < 0).length,
    dueSoon: open.filter((t) => daysUntil(t.due!) >= 0 && daysUntil(t.due!) <= 7).length,
    next: open.find((t) => daysUntil(t.due!) >= 0) ?? open[0],
    pct: counted.length ? Math.round((done / counted.length) * 100) : 0,
  }
}

/** By date and time, undated last; done items after open ones. */
export function compareCoursework(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  const ad = `${a.due ?? "9999-99-99"} ${a.time ?? "99:99"}`
  const bd = `${b.due ?? "9999-99-99"} ${b.time ?? "99:99"}`
  return ad.localeCompare(bd) || a.createdAt.localeCompare(b.createdAt)
}

/** "CS 2110" from a title when no code was given: initials of the first words. */
export const courseLabel = (c: Pick<Course, "code" | "title">) => c.code.trim() || c.title.trim().split(/\s+/).slice(0, 3).map((w) => w[0]).join("").toUpperCase()

/** Comma-separated input → clean, unique tags. */
export const parseTags = (input: string) => [...new Set(input.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 12)
