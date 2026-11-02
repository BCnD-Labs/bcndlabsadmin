import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { format } from "date-fns"
import { ChevronDown, Clock, GraduationCap, Plus, UserRound } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/common/empty-state"
import { ListGroupLabel } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { StatStrip } from "@/components/common/stat-strip"
import { daysUntil, parseKey } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import type { Course, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useCourseMap, useWorkspace } from "@/stores/workspace"
import { CourseTag, CourseworkRow, courseworkWhen } from "./coursework"
import { COURSE_STATUS_LABEL, compareCoursework, courseColor, courseProgress, courseStatus, learningType, type CourseStatus } from "./learning-utils"

type Filter = CourseStatus | "all"

/** "Add learning": only courses for now; other kinds of learning slot into this menu later. */
function AddLearning() {
  const openForm = useUi((s) => s.openForm)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus /> Add learning <ChevronDown className="opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="bw-label">Add learning</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openForm({ kind: "course" })} className="items-start py-2">
          <GraduationCap className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] text-ink">Course</span>
            <span className="text-[11px] leading-snug text-muted-foreground">A class with its assignments, exams, milestones and events.</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const dateRange = (c: Pick<Course, "startDate" | "endDate">) =>
  [c.startDate, c.endDate].filter(Boolean).map((d) => format(parseKey(d!), "MMM d, yyyy")).join(" – ")

function CourseCard({ course, items }: { course: Course; items: Task[] }) {
  const p = courseProgress(items)
  const status = courseStatus(course)
  const color = courseColor(course.color)
  const next = p.next
  return (
    <li className="flex">
      <Link
        to={courseHref(course.id)}
        className="bw-panel group flex flex-1 flex-col gap-3 p-4 lg:gap-2 lg:p-3 transition-colors duration-150 hover:bg-raised"
        data-testid="course-card"
      >
        <span className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-[10px]", color.bar)} aria-hidden />
        <div className="flex items-center gap-2">
          <CourseTag course={course} asLink={false} />
          <span className={cn("ml-auto text-[11px]", status === "active" ? "text-ink-2" : "text-muted-foreground")}>{COURSE_STATUS_LABEL[status]}</span>
        </div>
        <div className="min-w-0">
          <span className="block font-heading text-base lg:text-sm leading-snug font-bold text-ink">{course.title}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {course.instructor && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3" aria-hidden /> {course.instructor}
              </span>
            )}
            {course.schedule && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" aria-hidden /> {course.schedule}
              </span>
            )}
            {!course.instructor && !course.schedule && (course.term || dateRange(course) || "No details yet")}
          </span>
        </div>
        <div className="mt-auto grid gap-1.5">
          <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
            <span>
              {p.total ? (
                <>
                  <span className="font-semibold text-ink tabular-nums">{p.done}</span> of {p.total} done
                </>
              ) : (
                "No coursework yet"
              )}
            </span>
            {p.overdue > 0 && <span className="font-semibold text-amber">{p.overdue} overdue</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-off" role="progressbar" aria-label={`${course.title} progress`} aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full", color.bar)} style={{ width: `${p.pct}%` }} />
          </div>
        </div>
        <div className="flex min-h-5 items-center gap-2 border-t border-line-soft pt-2.5 text-xs">
          {next ? (
            <>
              <span className="text-muted-foreground">Next</span>
              <span className="min-w-0 flex-1 truncate text-ink">{next.title}</span>
              <span className={cn("shrink-0 tabular-nums", daysUntil(next.due!) < 0 ? "text-amber" : "text-muted-foreground")}>{courseworkWhen(next)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Nothing due</span>
          )}
        </div>
      </Link>
    </li>
  )
}

/** Open coursework across courses: overdue, then the next 14 days. */
function Upcoming({ courses }: { courses: Map<string, Course> }) {
  const tasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)
  const items = tasks.filter((t) => t.courseId && courses.has(t.courseId) && !t.done && t.due && daysUntil(t.due) <= 14).sort(compareCoursework)
  const groups = [
    { label: "Overdue", tone: "warn" as const, items: items.filter((t) => daysUntil(t.due!) < 0) },
    { label: "Next 7 days", items: items.filter((t) => daysUntil(t.due!) >= 0 && daysUntil(t.due!) <= 7) },
    { label: "Week after", items: items.filter((t) => daysUntil(t.due!) > 7) },
  ].filter((g) => g.items.length)
  const firstActive = [...courses.values()].find((c) => courseStatus(c) === "active") ?? [...courses.values()][0]

  return (
    <Panel
      title="Upcoming coursework"
      tool="coursework"
      command="upcoming"
      meta={items.length || undefined}
      className="lg:sticky lg:top-[calc(var(--bw-header-h,88px)+12px)]"
      actions={
        <Button
          size="icon-sm"
          variant="quiet"
          aria-label="Add coursework"
          title="Add coursework"
          onClick={() => openForm({ kind: "task", defaults: { courseId: firstActive?.id, learningType: "assignment" } })}
        >
          <Plus />
        </Button>
      }
    >
      {groups.length ? (
        groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <ListGroupLabel tone={g.tone}>
              {g.label} <span className="text-faint">· {g.items.length}</span>
            </ListGroupLabel>
            <ul>
              {g.items.map((t) => (
                <CourseworkRow key={t.id} task={t} course={courses.get(t.courseId!)} showCourse />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState icon={learningType("assignment").icon} title="Nothing due in the next two weeks">
          Assignments, exams and events you add to a course show up here, in Tasks and on the calendar.
        </EmptyState>
      )}
    </Panel>
  )
}

export function LearningPage() {
  const courses = useWorkspace((s) => s.courses)
  const tasks = useWorkspace((s) => s.tasks)
  const courseMap = useCourseMap()
  const openForm = useUi((s) => s.openForm)
  const [filter, setFilter] = useState<Filter>("active")

  const byCourse = new Map<string, Task[]>()
  for (const t of tasks) if (t.courseId) byCourse.set(t.courseId, [...(byCourse.get(t.courseId) ?? []), t])
  const withStatus = courses.map((c) => ({ c, status: courseStatus(c) }))
  const counts = { active: 0, upcoming: 0, completed: 0 }
  for (const { status } of withStatus) counts[status]++
  // Land on a tab that has something in it.
  const effective: Filter = filter !== "all" && counts[filter] === 0 && courses.length ? (counts.active ? "active" : counts.upcoming ? "upcoming" : "all") : filter
  const shown = withStatus
    .filter(({ status }) => effective === "all" || status === effective)
    .sort((a, b) => (a.c.startDate ?? "").localeCompare(b.c.startDate ?? "") || a.c.title.localeCompare(b.c.title))
    .map(({ c }) => c)

  const active = withStatus.filter((x) => x.status === "active").map((x) => x.c.id)
  const activeItems = active.flatMap((id) => byCourse.get(id) ?? [])
  const totals = courseProgress(activeItems)

  return (
    <>
      <PageHeader
        title="Learning"
        actions={<AddLearning />}
      />
      {courses.length === 0 ? (
        <WorkspaceGrid><GridItem span={2}><Panel title="Courses" tool="learning" command="ls">
          <EmptyState
            roomy
            icon={GraduationCap}
            title="No courses yet"
            action={
              <Button variant="outline" onClick={() => openForm({ kind: "course" })}>
                <Plus /> Add a course
              </Button>
            }
          >
            Add a course with its dates and instructor, then track assignments, exams, milestones and events. They show up in Tasks and on your calendar.
          </EmptyState>
        </Panel></GridItem></WorkspaceGrid>
      ) : (
        <WorkspaceGrid>
          <GridItem span="full"><StatStrip
            items={[
              { label: "Courses in progress", value: counts.active, sub: counts.upcoming ? `${counts.upcoming} upcoming` : undefined },
              { label: "Due this week", value: totals.dueSoon },
              { label: "Overdue", value: totals.overdue, tone: totals.overdue ? "warn" : undefined },
              { label: "Completed", value: `${totals.pct}%`, sub: totals.total ? `${totals.done} of ${totals.total}` : undefined },
            ]}
          />
          </GridItem>
          <GridItem span={3}>
            <section aria-label="Courses" className="bw-grid-region grid gap-3">
              <SegmentedTabs
                label="Show courses"
                className="w-full sm:w-auto sm:self-start lg:justify-self-start"
                tabClassName="px-2 sm:px-3"
                value={effective}
                onChange={setFilter}
                tabs={[
                  { value: "active", label: "Active", count: counts.active },
                  { value: "upcoming", label: "Upcoming", count: counts.upcoming },
                  { value: "completed", label: "Done", count: counts.completed },
                  { value: "all", label: "All", count: courses.length },
                ]}
              />
              {shown.length ? (
                <ul className="bw-card-grid">
                  {shown.map((c) => (
                    <CourseCard key={c.id} course={c} items={byCourse.get(c.id) ?? []} />
                  ))}
                </ul>
              ) : (
                <Panel title="Courses" tool="learning" command="ls">
                  <EmptyState icon={GraduationCap} title="No courses here" />
                </Panel>
              )}
            </section>
          </GridItem>
          <GridItem><Upcoming courses={courseMap} /></GridItem>
        </WorkspaceGrid>
      )}
    </>
  )
}
