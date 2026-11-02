import { Award, BookOpen, BookOpenCheck, CalendarDays, ClipboardList, Flag, GraduationCap, ListChecks, MonitorPlay, Zap, type LucideIcon } from "lucide-react"
import { daysUntil, todayKey } from "@/lib/dates"
import type { Course, CourseColor, LearningItemType, LearningKind, Task } from "@/lib/types"

/** Coursework kinds. Every one is a task with `courseId` + `learningType`, so it shares Tasks and the calendar. */
export const LEARNING_TYPES: { value: LearningItemType; label: string; plural: string; icon: LucideIcon; dateLabel: string }[] = [
  { value: "assignment", label: "Assignment", plural: "Assignments", icon: ClipboardList, dateLabel: "Due date" },
  { value: "exam", label: "Exam", plural: "Exams", icon: BookOpenCheck, dateLabel: "Date" },
  { value: "milestone", label: "Milestone", plural: "Milestones", icon: Flag, dateLabel: "Target date" },
  { value: "event", label: "Event", plural: "Events", icon: CalendarDays, dateLabel: "Date" },
]

export type LearningTypeInfo = (typeof LEARNING_TYPES)[number]

/** How each kind of learning names its shared fields and items. Items are always tasks. */
export interface KindInfo {
  value: LearningKind
  label: string
  plural: string
  icon: LucideIcon
  description: string
  /** Name field label and placeholder. */
  name: [string, string]
  /** What `instructor` means here, or null to hide it. */
  person: [string, string] | null
  /** What `endDate` means here. */
  endLabel: string
  /** What `url` means here. */
  linkLabel: string
  /** Item types this kind uses, relabeled; the first is the quick-add default. */
  types: { value: LearningItemType; label: string; plural: string; icon?: LucideIcon; dateLabel?: string }[]
  /** The item type that measures progress, or undefined for "everything but events". */
  progressType?: LearningItemType
}

export const KINDS: KindInfo[] = [
  {
    value: "course", label: "Course", plural: "Courses", icon: GraduationCap,
    description: "A class: instructor, schedule, assignments and exams.",
    name: ["Course name", "e.g. Data Structures"], person: ["Instructor", "Name"], endLabel: "End date", linkLabel: "Course site",
    types: [{ value: "assignment", label: "Assignment", plural: "Assignments" }, { value: "exam", label: "Exam", plural: "Exams" }, { value: "milestone", label: "Milestone", plural: "Milestones" }, { value: "event", label: "Event", plural: "Events" }],
  },
  {
    value: "certification", label: "Certification", plural: "Certifications", icon: Award,
    description: "An exam to pass: objective domains, practice tests, exam date.",
    name: ["Certification", "e.g. CCNA 200-301"], person: ["Vendor", "e.g. Cisco"], endLabel: "Exam date", linkLabel: "Exam page",
    types: [{ value: "milestone", label: "Exam domain", plural: "Exam domains", icon: ListChecks, dateLabel: "Target date" }, { value: "exam", label: "Practice test", plural: "Practice tests" }, { value: "assignment", label: "Study task", plural: "Study tasks" }, { value: "event", label: "Event", plural: "Events" }],
    progressType: "milestone",
  },
  {
    value: "selfpaced", label: "Self-paced", plural: "Self-paced", icon: MonitorPlay,
    description: "An online course or series: link, modules, progress.",
    name: ["Course name", "e.g. Docker Mastery"], person: ["Platform", "e.g. Udemy, YouTube"], endLabel: "Target finish", linkLabel: "Course link",
    types: [{ value: "milestone", label: "Section", plural: "Sections", dateLabel: "Target date" }, { value: "assignment", label: "Exercise", plural: "Exercises" }],
    progressType: "milestone",
  },
  {
    value: "skill", label: "Skill", plural: "Skills", icon: Zap,
    description: "An open-ended topic: a goal, resources and milestones.",
    name: ["Skill or topic", "e.g. Rust"], person: null, endLabel: "Target date", linkLabel: "Main resource",
    types: [{ value: "milestone", label: "Milestone", plural: "Milestones" }, { value: "assignment", label: "Practice", plural: "Practice" }],
  },
  {
    value: "reading", label: "Reading", plural: "Reading", icon: BookOpen,
    description: "A book or long read: pages and linked notes.",
    name: ["Title", "e.g. The Phoenix Project"], person: ["Author", "Name"], endLabel: "Finished on", linkLabel: "Link",
    types: [{ value: "milestone", label: "Chapter", plural: "Chapters", dateLabel: "Target date" }, { value: "assignment", label: "Reading goal", plural: "Reading goals" }],
    progressType: "milestone",
  },
]

export const kindOf = (c?: Pick<Course, "kind">): LearningKind => c?.kind ?? "course"
export const kindInfo = (k?: LearningKind) => KINDS.find((x) => x.value === k) ?? KINDS[0]

/** An item type as its kind of learning names it ("Exam domain" for a certification milestone). */
export function learningType(t?: LearningItemType, kind?: LearningKind): LearningTypeInfo {
  const base = LEARNING_TYPES.find((x) => x.value === t) ?? LEARNING_TYPES[0]
  const own = kindInfo(kind).types.find((x) => x.value === base.value)
  return own ? { ...base, label: own.label, plural: own.plural, icon: own.icon ?? base.icon, dateLabel: own.dateLabel ?? base.dateLabel } : base
}

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

/** From the dates: not started yet, finished, or in progress (also when no dates are set). A finished book is done. */
export function courseStatus(c: Pick<Course, "startDate" | "endDate"> & Partial<Pick<Course, "kind" | "pagesRead" | "pagesTotal">>, today = todayKey()): CourseStatus {
  if (c.kind === "reading" && c.pagesTotal && (c.pagesRead ?? 0) >= c.pagesTotal) return "completed"
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

/**
 * Assignments, exams and milestones count toward progress; events don't. Pass `only` to
 * count one item type (a certification's domains, a self-paced course's sections).
 */
export function courseProgress(items: Task[], only?: LearningItemType): CourseProgress {
  const byType = only ? items.filter((t) => (t.learningType ?? "assignment") === only) : []
  const counted = byType.length ? byType : items.filter((t) => t.learningType !== "event")
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

/** Progress for any kind of learning: what's counted, how it reads, and the percent. */
export interface KindProgress extends CourseProgress {
  /** "14 of 24 done", "3 of 6 exam domains", "p. 126 of 360". */
  summary: string
  /** Certifications: the best practice-test score. */
  best?: number
  /** False when nothing measures progress (a skill without milestones). */
  measured: boolean
}

export function kindProgress(course: Course, items: Task[]): KindProgress {
  const info = kindInfo(kindOf(course))
  const p = courseProgress(items, info.progressType)
  const counted = info.progressType ? items.filter((t) => (t.learningType ?? "assignment") === info.progressType) : []
  const noun = counted.length ? info.types.find((t) => t.value === info.progressType)!.plural.toLowerCase() : "done"
  const summary = p.total ? (noun === "done" ? `${p.done} of ${p.total} done` : `${p.done} of ${p.total} ${noun}`) : `No ${info.types[0].plural.toLowerCase()} yet`
  if (info.value === "reading" && course.pagesTotal) {
    const read = Math.min(course.pagesRead ?? 0, course.pagesTotal)
    return { ...p, summary: `p. ${read} of ${course.pagesTotal}`, pct: Math.round((read / course.pagesTotal) * 100), measured: true }
  }
  const scores = items.filter((t) => t.learningType === "exam" && typeof t.score === "number").map((t) => t.score!)
  return { ...p, summary, best: info.value === "certification" && scores.length ? Math.max(...scores) : undefined, measured: p.total > 0 }
}
