import { CalendarRange, ChevronDown, Clock, ExternalLink, GraduationCap, Mail, MapPin, NotebookPen, Pencil, Plus, Tag, UserRound } from "lucide-react"
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
import { ListGroupLabel } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { StickyNote } from "@/features/notes/notes-page"
import { daysUntil } from "@/lib/dates"
import { parseQuickAdd } from "@/lib/quick-add"
import { learningHref, notesHref } from "@/lib/routes"
import type { Course, LearningItemType, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { CourseTag, CourseworkRow } from "./coursework"
import { dateRange } from "./learning-page"
import { COURSE_STATUS_LABEL, LEARNING_TYPES, compareCoursework, courseColor, courseProgress, courseStatus } from "./learning-utils"

type View = "open" | "done" | "all"

function AddItem({ course }: { course: Course }) {
  const openForm = useUi((s) => s.openForm)
  const add = (learningType: LearningItemType) => openForm({ kind: "task", defaults: { courseId: course.id, learningType } })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg">
          <Plus /> Add <ChevronDown className="opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="bw-label">Add to {course.code || "course"}</DropdownMenuLabel>
        {LEARNING_TYPES.map((t) => (
          <DropdownMenuItem key={t.value} onSelect={() => add(t.value)}>
            <t.icon /> {t.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => openForm({ kind: "note", defaults: { courseId: course.id, color: "blue" } })}>
          <NotebookPen /> Note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Open items grouped by when; done items newest first. */
function Coursework({ course, items }: { course: Course; items: Task[] }) {
  const create = useWorkspace((s) => s.create)
  const [view, setView] = useState<View>("open")
  const [quick, setQuick] = useState("")
  const open = items.filter((t) => !t.done).sort(compareCoursework)
  const done = items.filter((t) => t.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))

  const groups =
    view === "done"
      ? [{ label: "Done", items: done }]
      : [
          { label: "Overdue", tone: "warn" as const, items: open.filter((t) => t.due && daysUntil(t.due) < 0) },
          { label: "Next 7 days", items: open.filter((t) => t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7) },
          { label: "Later", items: open.filter((t) => t.due && daysUntil(t.due) > 7) },
          { label: "No date", items: open.filter((t) => !t.due) },
          ...(view === "all" ? [{ label: "Done", items: done }] : []),
        ]
  const shown = groups.filter((g) => g.items.length)

  const add = () => {
    const { title, due } = parseQuickAdd(quick)
    if (!title) return
    create("tasks", { title, due, courseId: course.id, learningType: "assignment", starred: false, done: false })
    setQuick("")
    toast.success(due ? `Assignment added for ${due}` : "Assignment added")
  }

  return (
    <Panel tool={course.code ? course.code.toLowerCase().replace(/\s+/g, "") : "course"} command="coursework" meta={`${open.length} open · ${done.length} done`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5">
        <SegmentedTabs
          label="Show coursework"
          value={view}
          onChange={setView}
          tabClassName="px-3"
          tabs={[
            { value: "open", label: "To do", count: open.length },
            { value: "done", label: "Done", count: done.length },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex items-center gap-2 border-b border-line px-3.5 py-2"
      >
        <Plus className="size-3.5 shrink-0 text-faint" aria-hidden />
        <label htmlFor="course-quick-add" className="sr-only">Add an assignment</label>
        <input
          id="course-quick-add"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Add an assignment · end with “fri” to set a date"
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
        {quick.trim() && <Button type="submit" size="sm">Add</Button>}
      </form>
      {shown.length ? (
        shown.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <ListGroupLabel tone={"tone" in g ? g.tone : undefined}>
              {g.label} <span className="text-faint">· {g.items.length}</span>
            </ListGroupLabel>
            <ul>
              {g.items.map((t) => (
                <CourseworkRow key={t.id} task={t} course={course} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState icon={LEARNING_TYPES[0].icon} title={view === "done" ? "Nothing finished yet" : "Nothing to do"}>
          {view === "done" ? "Check items off and they land here." : "Add assignments above, or exams, milestones and events from the Add menu."}
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

function CourseInfo({ course, items }: { course: Course; items: Task[] }) {
  const p = courseProgress(items)
  const color = courseColor(course.color)
  const range = dateRange(course)
  return (
    <Panel tool="course" command="info" meta={course.credits != null ? `${course.credits} credits` : undefined} bodyClassName="px-3.5 py-3">
      <div className="mb-3 grid gap-1.5 border-b border-line-soft pb-3.5">
        <div className="flex items-baseline justify-between">
          <span className="font-heading text-3xl leading-none font-bold text-ink tabular-nums">{p.pct}%</span>
          <span className="text-xs text-muted-foreground">
            {p.total ? `${p.done} of ${p.total} done` : "No coursework yet"}
            {p.overdue > 0 && <span className="ml-2 font-semibold text-amber">{p.overdue} overdue</span>}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-off" role="progressbar" aria-label="Course progress" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full", color.bar)} style={{ width: `${p.pct}%` }} />
        </div>
        <p className="text-[11px] text-faint">Assignments, exams and milestones count; events don't.</p>
      </div>
      <dl>
        {course.instructor && (
          <InfoRow icon={UserRound} label="Instructor">
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
          <InfoRow icon={ExternalLink} label="Course site">
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
      {course.description && <p className="mt-2.5 border-t border-line-soft pt-2.5 text-xs leading-relaxed whitespace-pre-line text-ink-2">{course.description}</p>}
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
        <label htmlFor="course-note" className="sr-only">New note for this course</label>
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
          placeholder="Lecture notes, reminders, questions for office hours…"
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
        <PageHeader title="Course not found" back={{ to: learningHref, label: "Learning" }} />
        <Panel tool="learning" command={`open ${id}`} className="max-w-2xl">
          <EmptyState
            icon={GraduationCap}
            title="This course doesn't exist"
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
  const sub = [course.instructor, course.term || dateRange(course)].filter(Boolean).join(" · ")

  return (
    <>
      <PageHeader
        back={{ to: learningHref, label: "Learning" }}
        title={course.title}
        badge={
          <>
            <CourseTag course={course} asLink={false} />
            <span className="text-xs text-muted-foreground">{COURSE_STATUS_LABEL[status]}</span>
          </>
        }
        subtitle={sub || undefined}
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => openForm({ kind: "course", id: course.id })}>
              <Pencil /> Edit
            </Button>
            <AddItem course={course} />
          </>
        }
      />
      <div className="grid items-start gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Coursework course={course} items={items} />
        </div>
        <div className="grid gap-3">
          <CourseInfo course={course} items={items} />
          <CourseNotes course={course} />
        </div>
      </div>
    </>
  )
}
