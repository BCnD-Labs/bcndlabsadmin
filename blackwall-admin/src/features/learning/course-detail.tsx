import { DocLinksList } from "@/components/common/doc-links"
import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { CalendarRange, ChevronDown, Clock, ExternalLink, GraduationCap, Mail, MapPin, Pencil, Plus, StickyNote as NoteIcon, Tag, UserRound } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { FilterChips } from "@/components/common/filter-chips"
import { ListGroupLabel } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { StickyNote } from "@/features/notes/sticky-note"
import { daysUntil, todayKey } from "@/lib/dates"
import { parseQuickAdd } from "@/lib/quick-add"
import { learningHref, notesHref } from "@/lib/routes"
import type { Course, LearningItemType, Task } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { Input } from "@/components/ui/input"
import { CourseworkRow, KindIcon } from "./coursework"
import { ProgressBar, ProgressRing, dateRange, kindSubtitle } from "./learning-page"
import { COURSE_STATUS_LABEL, courseStatus, kindInfo, kindOf, kindProgress, kindTypeLabels, learningType, typeLabels } from "./learning-utils"
import { courseworkGroups, typeCounts, typeOptions, type CourseworkGroupBy, type CourseworkView } from "./coursework-view"

function AddItem({ course }: { course: Course }) {
  const openForm = useUi((s) => s.openForm)
  const info = kindInfo(kindOf(course))
  const add = (learningType: LearningItemType) => openForm({ kind: "task", defaults: { courseId: course.id, learningType } })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus /> Add <ChevronDown className="opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="bw-label">Add to {course.code || info.label.toLowerCase()}</DropdownMenuLabel>
        {info.types.map((t) => {
          const Icon = learningType(t.value, info.value).icon
          return (
            <DropdownMenuItem key={t.value} onSelect={() => add(t.value)}>
              <Icon /> {t.label}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuItem onSelect={() => openForm({ kind: "note", defaults: { courseId: course.id, color: "blue" } })}>
          <NoteIcon /> Note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** What the main item list is called for each kind. */
const ITEMS_TITLE: Record<string, string> = { course: "Coursework", certification: "Study plan", selfpaced: "Sections", skill: "Milestones", reading: "Chapters" }

/** Every item of a course in one list: To do / Done / All, type filter chips, grouped by when or by type. */
function Coursework({ course, items }: { course: Course; items: Task[] }) {
  const create = useWorkspace((s) => s.create)
  const kind = kindOf(course)
  const info = kindInfo(kind)
  const first = info.types[0]
  const firstLabel = first.label.toLowerCase()
  const article = /^[aeiou]/.test(firstLabel) ? "an" : "a"
  const [view, setView] = useState<CourseworkView>("open")
  const [types, setTypes] = useState<string[]>([])
  const [groupBy, setGroupBy] = useState<CourseworkGroupBy>("when")
  const [quick, setQuick] = useState("")
  const openCount = items.filter((t) => !t.done).length
  const doneCount = items.length - openCount
  const options = typeOptions(items, kindTypeLabels(kind), (t) => typeLabels(kind).find((x) => x.value === t)!)
  const counts = typeCounts(items, view)
  const chosen = types.filter((t): t is LearningItemType => options.some((o) => o.value === t))
  const shown = courseworkGroups(items, { view, types: chosen, groupBy, labels: options, today: todayKey() })

  const add = () => {
    const { title, due } = parseQuickAdd(quick)
    if (!title) return
    create("tasks", { title, due, courseId: course.id, learningType: first.value, starred: false, done: false })
    setQuick("")
    toast.success(due ? `${first.label} added for ${due}` : `${first.label} added`)
  }

  return (
    <Panel category="learning" title={ITEMS_TITLE[info.value]} tool={course.code ? course.code.toLowerCase().replace(/\s+/g, "") : "course"} command="coursework" meta={`${openCount} open · ${doneCount} done`}>
      <div className="grid gap-2 border-b border-line px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedTabs
            label={`Show ${ITEMS_TITLE[info.value].toLowerCase()}`}
            value={view}
            onChange={setView}
            tabClassName="px-3"
            tabs={[
              { value: "open", label: "To do", count: openCount },
              { value: "done", label: "Done", count: doneCount },
              { value: "all", label: "All" },
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-[0.04em] text-faint uppercase" aria-hidden>Group by</span>
            <SegmentedTabs
              label="Group by"
              value={groupBy}
              onChange={setGroupBy}
              tabClassName="flex-none px-2.5"
              tabs={[{ value: "when", label: "When" }, { value: "type", label: "Type" }]}
            />
          </div>
        </div>
        {options.length > 1 && (
          <FilterChips
            wrap
            label="Type"
            value={chosen}
            onChange={setTypes}
            allCount={counts.all}
            options={options.map((o) => {
              const Icon = learningType(o.value, kind).icon
              return { value: o.value, label: o.plural, count: counts[o.value], icon: <Icon data-item-type={o.value} className="size-3 text-[var(--bw-type)]" aria-hidden /> }
            })}
          />
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex items-center gap-2 border-b border-line px-3.5 py-2"
      >
        <Plus className="size-3.5 shrink-0 text-faint" aria-hidden />
        <label htmlFor="course-quick-add" className="sr-only">Add {article} {firstLabel}</label>
        <input
          id="course-quick-add"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder={`Add ${article} ${firstLabel} · end with “fri” to set a date`}
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
        {quick.trim() && <Button type="submit" size="sm">Add</Button>}
      </form>
      {shown.length ? (
        shown.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <ListGroupLabel tone={g.tone}>
              {g.label} <span className="text-faint">· {g.items.length}</span>
            </ListGroupLabel>
            <ul>
              {g.items.map((t) => (
                <CourseworkRow key={t.id} task={t} course={course} />
              ))}
            </ul>
          </section>
        ))
      ) : chosen.length ? (
        <EmptyState icon={learningType(chosen[0], kind).icon} title="Nothing of this type here">
          {view === "done" ? "Nothing of the chosen types is done yet." : "Try All, or another tab."}
        </EmptyState>
      ) : (
        <EmptyState icon={learningType(first.value, kind).icon} title={view === "done" ? "Nothing finished yet" : "Nothing to do"}>
          {view === "done" ? "Check items off and they land here." : `Add ${first.plural.toLowerCase()} above${info.types.length > 1 ? `, or ${info.types.slice(1).map((t) => t.plural.toLowerCase()).join(", ")} from the Add menu` : ""}.`}
        </EmptyState>
      )}
    </Panel>
  )
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[16px_5.5rem_minmax(0,1fr)] items-start gap-2 py-1.5 text-[13px]">
      <Icon className="mt-0.5 size-3.5 text-faint" aria-hidden />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  )
}

/** Reading: update pages read without opening the form. */
function PagesRead({ course }: { course: Course }) {
  const update = useWorkspace((s) => s.update)
  const [v, setV] = useState(String(course.pagesRead ?? ""))
  const n = Number(v)
  const ok = v.trim() !== "" && Number.isInteger(n) && n >= 0 && n !== course.pagesRead
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        update("courses", course.id, { pagesRead: n })
        toast.success(`Now on page ${n}`)
      }}
    >
      <label htmlFor="pages-read" className="text-xs text-muted-foreground">Pages read</label>
      <Input id="pages-read" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} className="h-[var(--bw-control-sm)] w-20 text-[13px]" />
      <Button type="submit" size="sm" variant="outline" disabled={!ok}>Update</Button>
    </form>
  )
}

function CourseInfo({ course, items }: { course: Course; items: Task[] }) {
  const info = kindInfo(kindOf(course))
  const p = kindProgress(course, items)
  const range = dateRange(course)
  const cert = info.value === "certification"
  return (
    <Panel category="learning" title={`${info.label} overview`} tool="course" command="info" meta={course.credits != null && info.value === "course" ? `${course.credits} credits` : undefined} bodyClassName="px-3.5 py-3">
      <div data-category={`kind-${info.value}`} className="mb-3 grid gap-1.5 border-b border-line-soft pb-3.5">
        {cert ? (
          <div className="flex items-center gap-3.5">
            <ProgressRing pct={p.pct} label="Exam domains" size={64} />
            <div className="grid gap-0.5 text-xs text-muted-foreground">
              <span>{p.total ? <><span className="font-semibold text-ink tabular-nums">{p.done} of {p.total}</span> exam domains</> : "No exam domains yet"}</span>
              <span>{p.best != null ? <>Best practice test <span className="font-semibold text-ink tabular-nums">{p.best}%</span></> : "No practice test scores yet"}</span>
              {course.endDate && <span>{daysUntil(course.endDate) >= 0 ? <><span className="font-semibold text-ink tabular-nums">{daysUntil(course.endDate)}</span> days to the exam</> : "Exam date passed"}</span>}
            </div>
          </div>
        ) : p.measured ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-heading text-3xl lg:text-2xl leading-none font-bold text-ink tabular-nums">{p.pct}%</span>
              <span className="text-xs text-muted-foreground">
                {p.summary}
                {p.overdue > 0 && <span className="ml-2 font-semibold text-amber">{p.overdue} overdue</span>}
              </span>
            </div>
            <ProgressBar pct={p.pct} label={`${info.label} progress`} />
            {info.value === "course" && <p className="text-[11px] text-faint">Assignments, exams and milestones count; events don't.</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{info.value === "skill" ? "Add milestones to see progress." : p.summary}</p>
        )}
        {info.value === "reading" && <PagesRead key={course.pagesRead ?? -1} course={course} />}
      </div>
      <dl>
        {course.instructor && (
          <InfoRow icon={UserRound} label={info.person?.[0] ?? "Instructor"}>
            {course.instructor}
          </InfoRow>
        )}
        {course.instructorEmail && (
          <InfoRow icon={Mail} label="Email">
            <a href={`mailto:${course.instructorEmail}`} className="underline-offset-2 hover:underline">{course.instructorEmail}</a>
          </InfoRow>
        )}
        {course.schedule && (
          <InfoRow icon={Clock} label="Schedule">
            {course.schedule}
          </InfoRow>
        )}
        {course.location && (
          <InfoRow icon={MapPin} label="Location">
            {course.location}
          </InfoRow>
        )}
        {(range || course.term) && (
          <InfoRow icon={CalendarRange} label="Dates">
            {[course.term, range].filter(Boolean).join(" · ")}
          </InfoRow>
        )}
        {course.url && (
          <InfoRow icon={ExternalLink} label={info.linkLabel}>
            <a href={course.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {course.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </InfoRow>
        )}
        {course.tags.length > 0 && (
          <InfoRow icon={Tag} label="Tags">
            <span className="flex flex-wrap gap-1">
              {course.tags.map((t) => (
                <span key={t} className="inline-flex h-5 items-center rounded-full bg-ink-2/8 px-2 text-[11px] font-medium text-ink-2">{t}</span>
              ))}
            </span>
          </InfoRow>
        )}
      </dl>
      {course.description && info.value !== "skill" && <p className="mt-2.5 border-t border-line-soft pt-2.5 text-xs leading-relaxed whitespace-pre-line text-ink-2">{course.description}</p>}
      {!!course.links?.length && <div className="mt-2.5 border-t border-line-soft pt-2.5"><p className="bw-label mb-1.5">{info.value === "skill" ? "Resources" : "Linked documents"}</p><DocLinksList links={course.links} /></div>}
    </Panel>
  )
}

function CourseNotes({ course }: { course: Course }) {
  const notes = useWorkspace((s) => s.notes)
  const create = useWorkspace((s) => s.create)
  const [text, setText] = useState("")
  const linked = notes.filter((n) => n.courseId === course.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const add = () => {
    if (!text.trim()) return
    create("notes", { text: text.trim(), color: "blue", pinned: false, courseId: course.id })
    setText("")
  }
  return (
    <Panel
      category="learning"
      title="Notes"
      tool="course"
      command="notes"
      meta={linked.length || undefined}
      actions={
        <Button variant="quiet" size="sm" asChild className="text-muted-foreground">
          <Link to={notesHref}>All notes</Link>
        </Button>
      }
      bodyClassName="flex flex-col gap-3 px-3.5 py-3"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="course-note" className="sr-only">New note</label>
        <Textarea
          id="course-note"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              add()
            }
          }}
          placeholder={kindOf(course) === "course" ? "Lecture notes, reminders, questions for office hours…" : "Notes, reminders, questions…"}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-faint">Also on the Notes page · ⌘/Ctrl + Enter</span>
          <Button type="submit" size="sm" disabled={!text.trim()}>
            <Plus /> Add note
          </Button>
        </div>
      </form>
      {linked.length > 0 && (
        <ul className="grid gap-2.5" aria-label="Notes for this course">
          {linked.map((n) => (
            <StickyNote key={n.id} note={n} compact />
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function CourseDetail() {
  const { id = "" } = useParams()
  const course = useWorkspace((s) => s.courses.find((c) => c.id === id))
  const tasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)

  if (!course) {
    return (
      <>
        <PageHeader title="Not found" back={{ to: learningHref, label: "Learning" }} />
        <Panel tool="learning" command={`open ${id}`} className="max-w-2xl">
          <EmptyState
            icon={GraduationCap}
            title="This doesn't exist"
            action={
              <Button variant="outline" asChild>
                <Link to={learningHref}>Back to Learning</Link>
              </Button>
            }
          >
            It may have been deleted.
          </EmptyState>
        </Panel>
      </>
    )
  }

  const items = tasks.filter((t) => t.courseId === course.id)
  const status = courseStatus(course)
  const kind = kindOf(course)
  const sub = kind === "course" ? [course.instructor, course.term || dateRange(course)].filter(Boolean).join(" · ") : kindSubtitle(course)

  return (
    <>
      <PageHeader
        back={{ to: learningHref, label: "Learning" }}
        title={course.title}
        badge={
          <>
            <KindIcon kind={kind} small />
            <span className="hidden text-xs text-muted-foreground xl:inline">{COURSE_STATUS_LABEL[status]}</span>
          </>
        }
        subtitle={sub || undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => openForm({ kind: "course", id: course.id })}>
              <Pencil /> Edit
            </Button>
            <AddItem course={course} />
          </>
        }
      />
      <WorkspaceGrid>
        <GridItem span={2}>
          <Coursework course={course} items={items} />
        </GridItem>
        <GridItem><CourseInfo course={course} items={items} /></GridItem>
        <GridItem><CourseNotes course={course} /></GridItem>
      </WorkspaceGrid>
    </>
  )
}
