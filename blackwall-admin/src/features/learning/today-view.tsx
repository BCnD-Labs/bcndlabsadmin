import { format } from "date-fns"
import { CalendarCheck, Clock, MapPin, Play, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/common/empty-state"
import { ListGroupLabel } from "@/components/common/list"
import { Panel } from "@/components/common/panel"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { formatTime, parseKey } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import type { Course, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useCourseMap, useWorkspace } from "@/stores/workspace"
import { setTaskStatus } from "@shared/records"
import { dueWords, meetingKindLabel, minutesOf, todayPlan, type MeetingOccurrence } from "@shared/learning"
import { CourseworkRow, CourseTag } from "./coursework"
import { StepRow } from "./step-row"
import { StudyPlanButton } from "./study-plan"
import { courseColor } from "./learning-utils"

function ClassRow({ occurrence, now }: { occurrence: MeetingOccurrence; now: number }) {
  const { course, meeting } = occurrence
  const start = minutesOf(meeting.start), end = minutesOf(meeting.end)
  const state = now >= end ? "over" : now >= start ? "now" : "later"
  return (
    <li className={cn("border-b border-line-soft last:border-b-0", state === "over" && "opacity-55")}>
      <Link to={courseHref(course.id)} className="flex min-h-11 items-center gap-3 px-3.5 py-1.5 hover:bg-raised">
        <span className={cn("h-8 w-1 shrink-0 rounded-full", courseColor(course.color).bar)} aria-hidden />
        <span className="w-[5.5rem] shrink-0 text-[12px] tabular-nums text-ink-2">{formatTime(meeting.start)}<span className="block text-[10px] text-muted-foreground">to {formatTime(meeting.end)}</span></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-ink">{course.title}{meeting.kind !== "class" && <span className="ml-1.5 text-muted-foreground">· {meetingKindLabel(meeting.kind)}</span>}</span>
          {meeting.location && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="size-3" aria-hidden />{meeting.location}</span>}
        </span>
        {state === "now" && <span className="rounded-full bg-[#64b5f622] px-2 py-0.5 text-[10px] font-semibold text-[var(--bw-blue,#64b5f6)]">Now</span>}
      </Link>
    </li>
  )
}

function Group({ label, tone, items, courses }: { label: string; tone?: "warn"; items: Task[]; courses: Map<string, Course> }) {
  if (!items.length) return null
  return (
    <section aria-label={label}>
      <ListGroupLabel tone={tone}>{label} <span className="text-faint">· {items.length}</span></ListGroupLabel>
      <ul>{items.map((t) => <CourseworkRow key={t.id} task={t} course={courses.get(t.courseId!)} showCourse />)}</ul>
    </section>
  )
}

/** The answer to "what should I do right now?" for someone who doesn't plan: one clear next step, then the day. */
export function TodayView({ today }: { today: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const courseMap = useCourseMap()
  const openForm = useUi((s) => s.openForm)
  const now = useNow()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const plan = todayPlan({ tasks, courses }, today)
  const hasMeetings = courses.some((c) => c.meetings?.length)
  const quiet = !plan.classes.length && !plan.steps.length && !plan.studyNudges.length && !plan.overdue.length && !plan.dueToday.length && !plan.inProgress.length && !plan.startNow.length
  const next = plan.next
  const start = (task: Task) => {
    useWorkspace.setState((s) => setTaskStatus({ tasks: s.tasks }, task.id, "in_progress"))
    openForm({ kind: "task", id: task.id })
  }
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        <Panel category="learning" title={format(parseKey(today), "EEEE, MMMM d")} tool="learning" command="today">
          {next ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-3.5 py-3.5" data-testid="start-here">
              <Sparkles className="size-5 shrink-0 text-[var(--bw-blue,#64b5f6)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="bw-label">Start here</p>
                <p className="mt-0.5 text-[15px] font-semibold text-ink">{next.step ? next.step.title : next.task.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><CourseTag course={courseMap.get(next.task.courseId!)} asLink={false} />{next.step ? `${next.task.title} · ${next.why}` : next.why}</p>
              </div>
              <Button onClick={() => start(next.task)}><Play /> Start</Button>
            </div>
          ) : quiet ? (
            <EmptyState icon={CalendarCheck} title="Nothing needs you today">
              {hasMeetings || courses.length ? "Use the Week tab to look ahead and plan what is coming." : "Add a course and its class times to see your day here."}
            </EmptyState>
          ) : null}
          {plan.classes.length > 0 && <section aria-label="Classes today"><ListGroupLabel><Clock className="size-3" aria-hidden /> Classes today <span className="text-faint">· {plan.classes.length}</span></ListGroupLabel><ul>{plan.classes.map((o) => <ClassRow key={`${o.course.id}${o.meeting.id}`} occurrence={o} now={minutes} />)}</ul></section>}
          <Group label="Late: catch up first" tone="warn" items={plan.overdue} courses={courseMap} />
          <Group label="Due today" items={plan.dueToday} courses={courseMap} />
          {plan.steps.length > 0 && <section aria-label="Steps for today"><ListGroupLabel>Steps you planned <span className="text-faint">· {plan.steps.length}</span></ListGroupLabel><ul>{plan.steps.map((r) => <StepRow key={r.step.id} item={r} course={courseMap.get(r.task.courseId!)} today={today} />)}</ul></section>}
          <Group label="Keep going" items={plan.inProgress} courses={courseMap} />
          <Group label="Good days to begin" items={plan.startNow} courses={courseMap} />
          {plan.studyNudges.length > 0 && <section aria-label="Plan your studying"><ListGroupLabel>Exams coming up: plan your studying <span className="text-faint">· {plan.studyNudges.length}</span></ListGroupLabel><ul>{plan.studyNudges.map((t) => (
            <li key={t.id} className="flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0" data-testid="study-nudge">
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] text-ink">{t.title}</span><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CourseTag course={courseMap.get(t.courseId!)} asLink={false} className="h-[18px] text-[10px]" />{dueWords(t.due!, today)}</span></span>
              <StudyPlanButton taskId={t.id} size="xs" label="Plan studying" />
            </li>))}</ul></section>}
        </Panel>
      </div>
      <Panel category="learning" title="How this works" tool="learning" command="help" className="self-start" bodyClassName="grid gap-2 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <p><strong className="text-ink">Start here</strong> picks one thing: what is late, then what is due today, then what you already started, then what is due soon.</p>
        <p>Each assignment gets a <strong className="text-ink">start-by day</strong> a few days before it is due. Set how big it is in the assignment form to change that.</p>
        <p><strong className="text-ink">Steps</strong> break an assignment into pieces. Give a step a day and it shows up here on that day. For an exam, <strong className="text-ink">Plan studying</strong> counts back from the exam day.</p>
        <p>The <strong className="text-ink">Week</strong> tab turns the next two weeks into a plan you can accept or change. Nothing is saved until you say so.</p>
        <p className="text-faint">Class times come from each course's schedule.</p>
      </Panel>
    </div>
  )
}
