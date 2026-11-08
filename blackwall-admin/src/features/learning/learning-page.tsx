import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { format } from "date-fns"
import { ChevronDown, GraduationCap, Plus } from "lucide-react"
import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
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
import { daysUntil, parseKey, relativeDue, todayKey } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import type { Course, LearningKind, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useCourseMap, useWorkspace } from "@/stores/workspace"
import { CourseworkRow, KindIcon, courseworkWhen } from "./coursework"
import { TodayView } from "./today-view"
import { WeekView } from "./week-view"
import { TermView } from "./term-view"
import { COURSE_STATUS_LABEL, KINDS, compareCoursework, courseProgress, courseStatus, kindInfo, kindOf, kindProgress, learningType, type CourseStatus } from "./learning-utils"

type Filter = CourseStatus | "all"
type KindFilter = LearningKind | "all"

/** "Add learning": one entry per kind, each with what it tracks. */
function AddLearning({ label = "Add learning", variant }: { label?: string; variant?: "outline" }) {
  const openForm = useUi((s) => s.openForm)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant}>
          <Plus /> {label} <ChevronDown className="opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="bw-label">Add learning</DropdownMenuLabel>
        {KINDS.map((k) => (
          <DropdownMenuItem key={k.value} onSelect={() => openForm({ kind: "course", defaults: { kind: k.value } })} className="items-start gap-2.5 py-2">
            <KindIcon kind={k.value} />
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] text-ink">{k.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{k.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const dateRange = (c: Pick<Course, "startDate" | "endDate">) =>
  [c.startDate, c.endDate].filter(Boolean).map((d) => format(parseKey(d!), "MMM d, yyyy")).join(" – ")

/** The line under a card's title: what identifies this piece of learning. */
export function kindSubtitle(c: Course): string {
  switch (kindOf(c)) {
    case "certification": {
      const exam = c.endDate ? `Exam ${format(parseKey(c.endDate), "MMM d, yyyy")}${daysUntil(c.endDate) >= 0 ? ` · ${daysUntil(c.endDate)} days` : ""}` : "No exam date yet"
      return [c.instructor, exam].filter(Boolean).join(" · ")
    }
    case "selfpaced":
      return [c.instructor, c.url && "opens in browser"].filter(Boolean).join(" · ") || "Self-paced"
    case "skill":
      return c.description.split("\n")[0] || "No goal set"
    case "reading":
      return [c.instructor, c.links?.length ? `${c.links.length} linked note${c.links.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Reading"
    default:
      return [c.code, c.instructor, c.schedule].filter(Boolean).join(" · ") || c.term || dateRange(c) || "No details yet"
  }
}

/** A progress ring (certifications): percent in the middle. */
export function ProgressRing({ pct, label, size = 56 }: { pct: number; label: string; size?: number }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pct}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bw-off, #3a414c)" strokeWidth={6} className="stroke-off" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bw-category)" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="fill-ink text-[13px] font-semibold tabular-nums">{pct}%</text>
    </svg>
  )
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-off" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[var(--bw-category)]" style={{ width: `${pct}%` }} />
    </div>
  )
}

function CardBody({ course, items }: { course: Course; items: Task[] }) {
  const kind = kindOf(course)
  const p = kindProgress(course, items)
  if (kind === "certification") {
    return (
      <div className="flex items-center gap-3">
        <ProgressRing pct={p.pct} label={`${course.title} domains`} />
        <div className="grid gap-0.5 text-xs text-muted-foreground">
          <span>{p.total ? <><span className="font-semibold text-ink tabular-nums">{p.done} of {p.total}</span> exam domains</> : "No exam domains yet"}</span>
          <span>{p.best != null ? <>Best practice test <span className="font-semibold text-ink tabular-nums">{p.best}%</span></> : "No practice tests yet"}</span>
        </div>
      </div>
    )
  }
  if (kind === "skill") {
    const resources = (course.links?.length ?? 0) + (course.url ? 1 : 0)
    return (
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span><span className="font-semibold text-ink tabular-nums">{resources}</span> resource{resources === 1 ? "" : "s"}</span>
          {p.total > 0 && <span><span className="font-semibold text-ink tabular-nums">{p.done}</span> of {p.total} milestones</span>}
        </div>
        {p.total > 0 && <ProgressBar pct={p.pct} label={`${course.title} milestones`} />}
      </div>
    )
  }
  const [first, ...rest] = p.summary.split(" of ")
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{p.measured && rest.length ? <><span className="font-semibold text-ink tabular-nums">{first}</span> of {rest.join(" of ")}</> : p.summary}</span>
        {p.overdue > 0 ? <span className="font-semibold text-amber">{p.overdue} overdue</span> : p.measured && <span className="tabular-nums">{p.pct}%</span>}
      </div>
      <ProgressBar pct={p.pct} label={`${course.title} progress`} />
    </div>
  )
}

function LearningCard({ course, items }: { course: Course; items: Task[] }) {
  const status = courseStatus(course)
  const info = kindInfo(kindOf(course))
  const next = kindProgress(course, items).next
  return (
    <li className="flex">
      <Link
        to={courseHref(course.id)}
        data-category={`kind-${info.value}`}
        className="bw-panel group flex flex-1 flex-col gap-3 p-4 transition-colors duration-150 hover:bg-raised"
        data-testid="course-card"
      >
        <div className="flex items-center gap-2.5">
          <KindIcon kind={info.value} />
          <span className="text-xs font-semibold text-[var(--bw-category)]">{info.label}</span>
          <span className={cn("ml-auto text-[11px]", status === "active" ? "text-ink-2" : "text-muted-foreground")}>{COURSE_STATUS_LABEL[status]}</span>
        </div>
        <div className="min-w-0">
          <span className="block font-heading text-[15px] leading-snug font-bold text-ink">{course.title}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{kindSubtitle(course)}</span>
        </div>
        <div className="mt-auto">
          <CardBody course={course} items={items} />
        </div>
        <div className="flex min-h-5 items-center gap-2 border-t border-line-soft pt-2.5 text-xs">
          {next ? (
            <>
              <span className="text-muted-foreground">Next</span>
              <span className="min-w-0 flex-1 truncate text-ink">{next.title}</span>
              <span className={cn("shrink-0 tabular-nums", daysUntil(next.due!) < 0 ? "text-amber" : "text-muted-foreground")}>{courseworkWhen(next)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Nothing scheduled</span>
          )}
        </div>
      </Link>
    </li>
  )
}

/** Open items across every kind of learning: overdue, the next 14 days, then upcoming exam dates. */
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
  // Certification exam dates aren't tasks; they show as their own rows.
  const exams = [...courses.values()].filter((c) => kindOf(c) === "certification" && c.endDate && daysUntil(c.endDate) >= 0).sort((a, b) => a.endDate!.localeCompare(b.endDate!))
  const total = items.length + exams.length

  return (
    <Panel
      category="learning"
      title="Upcoming"
      tool="learning"
      command="upcoming"
      meta={total || undefined}
      className="lg:sticky lg:top-[calc(var(--bw-header-h,88px)+12px)]"
      actions={
        <Button
          size="icon-sm"
          variant="quiet"
          aria-label="Add an item"
          title="Add an item"
          onClick={() => openForm({ kind: "task", defaults: { courseId: firstActive?.id, learningType: "assignment" } })}
        >
          <Plus />
        </Button>
      }
    >
      {groups.length || exams.length ? (
        <>
        {groups.map((g) => (
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
        ))}
        {exams.length > 0 && (
          <section aria-label="Exam dates">
            <ListGroupLabel>
              Exam dates <span className="text-faint">· {exams.length}</span>
            </ListGroupLabel>
            <ul>
              {exams.map((c) => (
                <li key={c.id} className="border-b border-line-soft last:border-b-0">
                  <Link to={courseHref(c.id)} className="flex min-h-11 items-center gap-2.5 px-3.5 py-1.5 hover:bg-raised">
                    <KindIcon kind="certification" small />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{c.title} exam</span>
                    <span className={cn("shrink-0 text-[11px] tabular-nums", daysUntil(c.endDate!) <= 2 ? "text-ink" : "text-muted-foreground")}>{relativeDue(c.endDate!)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        </>
      ) : (
        <EmptyState icon={learningType("assignment").icon} title="Nothing due in the next two weeks">
          Assignments, exam domains, chapters and events you add show up here, in Tasks and on the calendar.
        </EmptyState>
      )}
    </Panel>
  )
}

const STATUS_LABEL: Record<Filter, string> = { active: "Active", upcoming: "Upcoming", completed: "Done", all: "Any status" }

type LearningView = "today" | "week" | "courses" | "term"

/** Learning opens on Today; Week plans ahead, Courses is the library, Term shows the semester. */
export function LearningPage() {
  const courses = useWorkspace((s) => s.courses)
  const [params, setParams] = useSearchParams()
  const asked = params.get("view")
  const view: LearningView = asked === "week" || asked === "courses" || asked === "term" || asked === "today" ? asked : courses.length ? "today" : "courses"
  const today = todayKey()
  const choose = (next: LearningView) => setParams((p) => { const n = new URLSearchParams(p); n.set("view", next); return n }, { replace: true })
  return (
    <>
      <PageHeader title="Learning" actions={<AddLearning />} />
      {courses.length > 0 && (
        <div className="mb-3">
          <SegmentedTabs<LearningView> label="Learning view" value={view} onChange={choose} className="max-w-full overflow-x-auto" tabs={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }, { value: "courses", label: "Courses" }, { value: "term", label: "Term" }]} />
        </div>
      )}
      {view === "today" ? <TodayView today={today} /> : view === "week" ? <WeekView today={today} /> : view === "term" ? <TermView today={today} /> : <Library />}
    </>
  )
}

function Library() {
  const courses = useWorkspace((s) => s.courses)
  const tasks = useWorkspace((s) => s.tasks)
  const courseMap = useCourseMap()
  const [filter, setFilter] = useState<Filter>("active")
  const [kind, setKind] = useState<KindFilter>("all")

  const byCourse = new Map<string, Task[]>()
  for (const t of tasks) if (t.courseId) byCourse.set(t.courseId, [...(byCourse.get(t.courseId) ?? []), t])
  const withStatus = courses.map((c) => ({ c, status: courseStatus(c), kind: kindOf(c) }))
  const counts = { active: 0, upcoming: 0, completed: 0 }
  for (const { status } of withStatus) counts[status]++
  // Land on a status that has something in it.
  const effective: Filter = filter !== "all" && counts[filter] === 0 && courses.length ? (counts.active ? "active" : counts.upcoming ? "upcoming" : "all") : filter
  const inStatus = withStatus.filter(({ status }) => effective === "all" || status === effective)
  const kindCounts = new Map<LearningKind, number>()
  for (const x of inStatus) kindCounts.set(x.kind, (kindCounts.get(x.kind) ?? 0) + 1)
  const kindTabs = KINDS.filter((k) => kindCounts.has(k.value))
  const effectiveKind: KindFilter = kind !== "all" && !kindCounts.has(kind) ? "all" : kind
  const shown = inStatus
    .filter((x) => effectiveKind === "all" || x.kind === effectiveKind)
    .sort((a, b) => KINDS.findIndex((k) => k.value === a.kind) - KINDS.findIndex((k) => k.value === b.kind) || (a.c.startDate ?? "").localeCompare(b.c.startDate ?? "") || a.c.title.localeCompare(b.c.title))
    .map(({ c }) => c)

  const active = withStatus.filter((x) => x.status === "active")
  const activeItems = active.flatMap((x) => byCourse.get(x.c.id) ?? [])
  const totals = courseProgress(activeItems)
  const activeCourses = active.filter((x) => x.kind === "course").length

  return (
    <>
      {courses.length === 0 ? (
        <WorkspaceGrid><GridItem span={2}><Panel category="learning" title="Learning" tool="learning" command="ls">
          <EmptyState roomy icon={GraduationCap} title="Nothing here yet" action={<AddLearning label="Add your first" variant="outline" />}>
            Track classes, certifications, self-paced courses, skills and books. Their dates show up in Tasks and on your calendar.
          </EmptyState>
        </Panel></GridItem></WorkspaceGrid>
      ) : (
        <WorkspaceGrid>
          <GridItem span="full"><StatStrip
            items={[
              { label: "In progress", value: counts.active, sub: counts.active ? `${activeCourses} course${activeCourses === 1 ? "" : "s"} · ${counts.active - activeCourses} other` : counts.upcoming ? `${counts.upcoming} upcoming` : undefined },
              { label: "Due this week", value: totals.dueSoon },
              { label: "Overdue", value: totals.overdue, tone: totals.overdue ? "warn" : undefined },
              { label: "Finished", value: counts.completed, sub: counts.upcoming ? `${counts.upcoming} upcoming` : undefined },
            ]}
          />
          </GridItem>
          <GridItem span={3}>
            <section aria-label="Learning" className="bw-grid-region grid grid-cols-[minmax(0,1fr)] gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedTabs
                  label="Show kind"
                  className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none]"
                  tabClassName="flex-none px-2.5 sm:px-3"
                  value={effectiveKind}
                  onChange={setKind}
                  tabs={[{ value: "all" as KindFilter, label: "All", count: inStatus.length }, ...kindTabs.map((k) => ({ value: k.value as KindFilter, label: k.plural, count: kindCounts.get(k.value) }))]}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label={`Status: ${STATUS_LABEL[effective]}`}>
                      {STATUS_LABEL[effective]} <ChevronDown className="opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="bw-label">Status</DropdownMenuLabel>
                    {(["active", "upcoming", "completed", "all"] as Filter[]).map((f) => (
                      <DropdownMenuItem key={f} onSelect={() => setFilter(f)} className={cn(f === effective && "text-ink")}>
                        <span className="flex-1">{STATUS_LABEL[f]}</span>
                        <span className="text-[11px] text-faint tabular-nums">{f === "all" ? courses.length : counts[f]}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {shown.length ? (
                <ul className="bw-card-grid">
                  {shown.map((c) => (
                    <LearningCard key={c.id} course={c} items={byCourse.get(c.id) ?? []} />
                  ))}
                </ul>
              ) : (
                <Panel category="learning" title="Learning" tool="learning" command="ls">
                  <EmptyState icon={GraduationCap} title="Nothing here" />
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
