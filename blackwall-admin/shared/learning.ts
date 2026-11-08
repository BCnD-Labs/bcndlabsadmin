/**
 * Pure learning-planning rules shared by the Mac/web Learning pages and the Android app: when a class
 * meets, what to do today, how heavy a week is, and a suggested week plan. Nothing here reads the
 * clock, preferences or the browser; "today" is always a `YYYY-MM-DD` parameter, and nothing is saved
 * unless the caller applies a proposal. No AI: every suggestion is a plain date rule the user can see.
 */
import type { ClassMeeting, Course, CourseTopic, MeetingKind, Subtask, Task, WorkEffort, WorkStatus } from "../src/lib/types.ts"
import { addDaysToKey, daysBetween, weekdayOfKey } from "./date-keys.ts"
import { hasPlannedSteps, openSteps, stepsDueBy, stepsOn, type StepRef } from "./steps.ts"
import type { Collections } from "./workspace.ts"

export type { ClassMeeting, CourseTopic, MeetingKind, Subtask, WorkEffort, WorkStatus }

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
export const MEETING_KINDS: { value: MeetingKind; label: string }[] = [
  { value: "class", label: "Class" },
  { value: "lab", label: "Lab" },
  { value: "office", label: "Office hours" },
  { value: "other", label: "Other" },
]
export const WORK_STATUSES: { value: WorkStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "graded", label: "Graded" },
]
/** Suggested days of lead time before a deadline. An exam needs a few sittings of review. */
export const EFFORTS: { value: WorkEffort; label: string; hint: string; lead: number }[] = [
  { value: "quick", label: "Quick", hint: "One sitting", lead: 1 },
  { value: "medium", label: "A few sittings", hint: "Start 3 days ahead", lead: 3 },
  { value: "big", label: "Big project", hint: "Start a week ahead", lead: 7 },
]
const EXAM_LEAD = 5
const DEFAULT_LEAD = 3
/** No more than this many suggested items on one day. */
export const PLAN_PER_DAY = 3

const MEETING_PREFIX = "mtg:"
export const isMeetingId = (id: string) => id.startsWith(MEETING_PREFIX)
export const meetingKindLabel = (kind: MeetingKind) => MEETING_KINDS.find((x) => x.value === kind)?.label ?? "Class"

/** "Mon/Wed", "Mon–Fri", "Sat/Sun". */
export function daysLabel(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  if (sorted.length === 5 && sorted[0] === 1 && sorted[4] === 5) return "Mon–Fri"
  return sorted.map((d) => WEEKDAY_LABELS[d]).join("/")
}

export const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

export interface MeetingOccurrence { course: Course; meeting: ClassMeeting; date: string }

/** The meetings of one course on one day. A course only meets between its start and end dates. */
export function meetingsOn(course: Course, date: string): ClassMeeting[] {
  if (!course.meetings?.length) return []
  if ((course.startDate && date < course.startDate) || (course.endDate && date > course.endDate)) return []
  const weekday = weekdayOfKey(date)
  return course.meetings.filter((m) => m.days.includes(weekday))
}

/** Every meeting on `date`, earliest first. */
export function meetingsForDay(courses: Course[], date: string): MeetingOccurrence[] {
  return courses.flatMap((course) => meetingsOn(course, date).map((meeting) => ({ course, meeting, date })))
    .sort((a, b) => a.meeting.start.localeCompare(b.meeting.start) || a.course.title.localeCompare(b.course.title))
}

/**
 * Meetings as read-only calendar events for `from`..`to`, so every calendar can draw them without
 * saving a record per week. Their ids start with `mtg:`; open the course instead of a task editor.
 */
export function meetingEvents(courses: Course[], from: string, to: string): Task[] {
  const out: Task[] = []
  const span = daysBetween(to, from)
  if (!(span >= 0) || span > 400) return out
  for (let i = 0; i <= span; i++) {
    const date = addDaysToKey(from, i)!
    for (const { course, meeting } of meetingsForDay(courses, date)) {
      const label = meeting.kind === "class" ? course.title : `${course.title} · ${meetingKindLabel(meeting.kind).toLowerCase()}`
      out.push({
        id: `${MEETING_PREFIX}${course.id}:${meeting.id}:${date}`, kind: "event", title: label, details: meeting.location || undefined,
        scheduledDate: date, scheduledTime: meeting.start, durationMinutes: Math.max(5, minutesOf(meeting.end) - minutesOf(meeting.start)),
        courseId: course.id, learningType: "event", starred: false, done: false, createdAt: course.updatedAt, updatedAt: course.updatedAt,
      })
    }
  }
  return out
}

/** The course a `mtg:` calendar event belongs to. */
export function meetingCourseId(id: string): string | undefined {
  if (!isMeetingId(id)) return undefined
  const rest = id.slice(MEETING_PREFIX.length)
  const meetingAt = rest.lastIndexOf(":", rest.lastIndexOf(":") - 1)
  return meetingAt > 0 ? rest.slice(0, meetingAt) : undefined
}

/** Where a task is in its life; older tasks derive it from `done`. */
export const statusOf = (t: Pick<Task, "status" | "done">): WorkStatus => t.status ?? (t.done ? "submitted" : "not_started")
export const statusLabel = (status: WorkStatus) => WORK_STATUSES.find((x) => x.value === status)?.label ?? "Not started"

/** Work you plan around: a course's open assignments, exams and milestones with a due date. */
function isPlannable(t: Task, courseIds: Set<string>): boolean {
  return !!t.courseId && courseIds.has(t.courseId) && !t.done && !!t.due && t.kind !== "event" && t.learningType !== "event"
}
const compareDue = (a: Task, b: Task) => a.due!.localeCompare(b.due!) || (a.time ?? "99").localeCompare(b.time ?? "99") || a.createdAt.localeCompare(b.createdAt)

/** How many days ahead of the deadline to begin. */
export function leadDays(t: Task): number {
  if (t.effort) return EFFORTS.find((e) => e.value === t.effort)!.lead
  return t.learningType === "exam" ? EXAM_LEAD : DEFAULT_LEAD
}
/** The date to begin by: the deadline minus the lead time. */
export const startBy = (t: Task): string | undefined => (t.due ? addDaysToKey(t.due, -leadDays(t)) : undefined)

export interface TodayPlan {
  classes: MeetingOccurrence[]
  overdue: Task[]
  dueToday: Task[]
  inProgress: Task[]
  /** Not due yet, but this is the day to start (or past it). */
  startNow: Task[]
  /** Steps you planned for today (or earlier) inside coursework. */
  steps: StepRef[]
  /** Exams coming up soon that have no study plan yet. */
  studyNudges: Task[]
  /** The single best next thing to do, with the reason in plain words. */
  next?: { task: Task; step?: Subtask; why: string }
}
/** An exam this close with nothing planned gets a nudge to plan studying. */
const STUDY_NUDGE_DAYS = 14

/** What today holds for someone who doesn't know where to begin. */
export function todayPlan(data: Pick<Collections, "tasks" | "courses">, today: string): TodayPlan {
  const ids = new Set(data.courses.map((c) => c.id))
  const open = data.tasks.filter((t) => isPlannable(t, ids)).sort(compareDue)
  const overdue = open.filter((t) => t.due! < today)
  const dueToday = open.filter((t) => t.due === today)
  const inProgress = open.filter((t) => t.due! > today && statusOf(t) === "in_progress")
  const startNow = open.filter((t) => t.due! > today && statusOf(t) !== "in_progress" && startBy(t)! <= today)
  const steps = stepsDueBy(data.tasks.filter((t) => t.courseId && ids.has(t.courseId)), today)
  const studyNudges = data.tasks.filter((t) => isPlannable(t, ids) && t.learningType === "exam" && t.due! > today && daysBetween(t.due!, today) <= STUDY_NUDGE_DAYS && !hasPlannedSteps(t)).sort(compareDue)
  const stepNext: TodayPlan["next"] = steps[0] ? { task: steps[0].task, step: steps[0].step, why: steps[0].step.date! < today ? `Step planned for ${dueWords(steps[0].step.date!, today)}: still open` : `Planned for today: ${steps[0].step.title}` } : undefined
  const next: TodayPlan["next"] = overdue[0] ? { task: overdue[0], why: `${-daysBetween(overdue[0].due!, today)} day${daysBetween(overdue[0].due!, today) === -1 ? "" : "s"} late: do this first` }
    : dueToday[0] ? { task: dueToday[0], why: "Due today" }
    : stepNext ? stepNext
    : inProgress[0] ? { task: inProgress[0], why: "You already started this" }
    : startNow[0] ? { task: startNow[0], why: `Due ${dueWords(startNow[0].due!, today)}: a good day to begin` }
    : undefined
  return { classes: meetingsForDay(data.courses, today), overdue, dueToday, inProgress, startNow, steps, studyNudges, next }
}

/** "tomorrow", "Fri", "in 9 days". */
export function dueWords(due: string, today: string): string {
  const n = daysBetween(due, today)
  if (n === 0) return "today"
  if (n === 1) return "tomorrow"
  if (n > 1 && n < 7) return WEEKDAY_LABELS[weekdayOfKey(due)]
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

export type DayLoad = "light" | "busy" | "heavy"
export interface WeekDay { date: string; classMinutes: number; classes: number; due: Task[]; exams: Task[]; focus: Task[]; steps: StepRef[]; load: DayLoad }

/** Seven days from `start`: classes, deadlines, exams and what's planned, with a plain light/busy/heavy rating. */
export function weekLoad(data: Pick<Collections, "tasks" | "courses">, start: string): WeekDay[] {
  const ids = new Set(data.courses.map((c) => c.id))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToKey(start, i)!
    const meetings = meetingsForDay(data.courses, date).filter((m) => m.meeting.kind !== "office")
    const work = data.tasks.filter((t) => !t.done && t.courseId && ids.has(t.courseId) && t.kind !== "event" && t.learningType !== "event")
    const due = work.filter((t) => t.due === date)
    const exams = due.filter((t) => t.learningType === "exam")
    const classMinutes = meetings.reduce((sum, m) => sum + minutesOf(m.meeting.end) - minutesOf(m.meeting.start), 0)
    const steps = stepsOn(work, date)
    const score = due.length + exams.length * 2 + classMinutes / 120 + steps.length * 0.5
    return { date, classMinutes, classes: meetings.length, due, exams, focus: work.filter((t) => t.focusDate === date), steps, load: score >= 4 ? "heavy" : score >= 2 ? "busy" : "light" }
  })
}

export interface PlanProposal { task: Task; date: string; why: string }

/**
 * Suggest which day to work on each upcoming assignment: begin at its start-by date, never past the
 * deadline, and spread so no day gets more than `perDay`. Items you already planned are left alone.
 */
export function planWeek(data: Pick<Collections, "tasks" | "courses">, today: string, horizon = 14, perDay = PLAN_PER_DAY): PlanProposal[] {
  const ids = new Set(data.courses.map((c) => c.id))
  const load = new Map<string, number>()
  for (const t of data.tasks) if (!t.done && t.focusDate && t.focusDate >= today) load.set(t.focusDate, (load.get(t.focusDate) ?? 0) + 1)
  for (const { step } of openSteps(data.tasks)) if (step.date && step.date >= today) load.set(step.date, (load.get(step.date) ?? 0) + 1)
  const out: PlanProposal[] = []
  const candidates = data.tasks.filter((t) => isPlannable(t, ids) && !(t.focusDate && t.focusDate >= today) && !hasPlannedSteps(t) && daysBetween(t.due!, today) <= horizon).sort(compareDue)
  for (const task of candidates) {
    const earliest = startBy(task)! > today ? startBy(task)! : today
    const latest = task.due! < today ? today : task.due!
    let day = earliest, moved = false
    while (day < latest && (load.get(day) ?? 0) >= perDay) { day = addDaysToKey(day, 1)!; moved = true }
    load.set(day, (load.get(day) ?? 0) + 1)
    const why = task.due! < today ? "Already late: start now"
      : moved ? `Due ${dueWords(task.due!, today)}; earlier days are full`
      : day === today ? `Due ${dueWords(task.due!, today)}: start today`
      : `Due ${dueWords(task.due!, today)}: start ${leadDays(task)} day${leadDays(task) === 1 ? "" : "s"} ahead`
    out.push({ task, date: day, why })
  }
  return out
}

export interface TimelineRow { course: Course; cells: { count: number; exam: boolean }[] }
export interface Timeline { weeks: { start: string; count: number; exam: boolean }[]; rows: TimelineRow[] }

/** Weekly workload across courses: open deadlines per course per week, for `weeks` weeks from `start`. */
export function termTimeline(data: Pick<Collections, "tasks" | "courses">, start: string, weeks: number): Timeline {
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDaysToKey(start, i * 7)!)
  const live = data.courses.filter((c) => (c.kind ?? "course") === "course" && !(c.endDate && c.endDate < start) && !(c.startDate && c.startDate >= addDaysToKey(start, weeks * 7)!))
  const rows = live.map((course) => ({
    course,
    cells: weekStarts.map((ws) => {
      const end = addDaysToKey(ws, 6)!
      const items = data.tasks.filter((t) => t.courseId === course.id && !t.done && t.kind !== "event" && t.learningType !== "event" && t.due && t.due >= ws && t.due <= end)
      return { count: items.length, exam: items.some((t) => t.learningType === "exam") }
    }),
  }))
  return { weeks: weekStarts.map((ws, i) => ({ start: ws, count: rows.reduce((n, r) => n + r.cells[i].count, 0), exam: rows.some((r) => r.cells[i].exam) })), rows }
}

export interface TermGroup { term: string; courses: Course[]; credits: number; start?: string }

/** Courses grouped by their term, in date order, with credit totals: the multi-semester map. */
export function degreeMap(courses: Course[]): TermGroup[] {
  const groups = new Map<string, TermGroup>()
  for (const c of courses.filter((x) => (x.kind ?? "course") === "course")) {
    const term = c.term.trim() || "No term"
    const g = groups.get(term) ?? { term, courses: [], credits: 0 }
    g.courses.push(c)
    g.credits += c.credits ?? 0
    if (c.startDate && (!g.start || c.startDate < g.start)) g.start = c.startDate
    groups.set(term, g)
  }
  return [...groups.values()].sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999") || a.term.localeCompare(b.term))
}

export interface TopicUse { topicId: string; assignments: number; exams: number }

/** How much open work points at each topic of a course. */
export function topicUsage(data: Pick<Collections, "tasks" | "courses">, courseId: string): TopicUse[] {
  const course = data.courses.find((c) => c.id === courseId)
  return (course?.topics ?? []).map((topic) => {
    const linked = data.tasks.filter((t) => t.courseId === courseId && !t.done && t.topicIds?.includes(topic.id))
    return { topicId: topic.id, assignments: linked.filter((t) => t.learningType !== "exam").length, exams: linked.filter((t) => t.learningType === "exam").length }
  })
}

export interface StudyProposal { title: string; date: string; topicId?: string }
const MAX_STUDY_LEAD = 21
const GENERIC_STUDY = ["Review your notes", "Practice questions"]
const FINAL_REVIEW = "Final review"

/**
 * A study plan that counts back from an exam: one review per topic the exam covers (or two general
 * sessions when no topics are set), spread over the days before it, with a final review the day
 * before. No more than `perDay` things on a day. Topics you marked as known, and steps already on
 * the exam, are skipped, so running it twice never doubles up. Nothing is saved here.
 */
export function studyPlan(data: Pick<Collections, "tasks" | "courses">, examId: string, today: string, perDay = PLAN_PER_DAY): StudyProposal[] {
  const exam = data.tasks.find((t) => t.id === examId)
  if (!exam || exam.done || !exam.due || exam.due <= today) return []
  const course = data.courses.find((c) => c.id === exam.courseId)
  const have = exam.subtasks ?? []
  const open = have.filter((s) => !s.done)
  const plannedTopics = new Set(open.map((s) => s.topicId).filter(Boolean))
  const openTitles = new Set(open.map((s) => s.title.trim().toLowerCase()))
  const covered = exam.topicIds?.length ? (course?.topics ?? []).filter((t) => exam.topicIds!.includes(t.id)) : []
  const items: { title: string; topicId?: string }[] = [
    ...covered.filter((t) => !t.done && !plannedTopics.has(t.id)).map((t) => ({ title: `Review: ${t.title}`, topicId: t.id })),
    ...(covered.length ? [] : GENERIC_STUDY.map((title) => ({ title }))),
    { title: FINAL_REVIEW },
  ].filter((i) => !openTitles.has(i.title.toLowerCase()))
  if (!items.length) return []
  const lead = Math.min(MAX_STUDY_LEAD, Math.max(leadDays(exam), items.length + 2))
  const first = addDaysToKey(exam.due, -lead)! > today ? addDaysToKey(exam.due, -lead)! : today
  const last = addDaysToKey(exam.due, -1)!
  const span = daysBetween(last, first) + 1
  const load = new Map<string, number>()
  for (const t of data.tasks) if (!t.done && t.focusDate && t.focusDate >= today) load.set(t.focusDate, (load.get(t.focusDate) ?? 0) + 1)
  for (const { step } of openSteps(data.tasks)) if (step.date && step.date >= today) load.set(step.date, (load.get(step.date) ?? 0) + 1)
  const free = (i: number) => (load.get(addDaysToKey(first, i)!) ?? 0) < perDay
  return items.map((item, n) => {
    let at = items.length === 1 || n === items.length - 1 ? span - 1 : Math.round((n * (span - 1)) / (items.length - 1))
    const wanted = at
    while (at < span - 1 && !free(at)) at++
    if (!free(at)) { at = wanted; while (at > 0 && !free(at)) at-- }
    if (!free(at)) at = wanted
    const date = addDaysToKey(first, at)!
    load.set(date, (load.get(date) ?? 0) + 1)
    return { ...item, date }
  }).sort((a, b) => a.date.localeCompare(b.date))
}
