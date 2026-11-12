import { DocLinksList } from "@/components/common/doc-links"
import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { CalendarRange, ChevronDown, Clock, ExternalLink, GitBranch, GraduationCap, Mail, MapPin, Pencil, Plus, StickyNote as NoteIcon, Tag, UserRound } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
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
import { PropChip } from "@/components/common/prop-chip"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { StickyNote } from "@/features/notes/sticky-note"
import { learningHref, notesHref } from "@/lib/routes"
import type { Course, LearningItemType, Task } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { Input } from "@/components/ui/input"
import { daysLabel, meetingKindLabel } from "@shared/learning"
import { formatTime } from "@/lib/dates"
import { KindIcon } from "./coursework"
import { WorkView } from "./work-view"
import { TopicsPanel } from "./topics-panel"
import { TopicChips } from "@/components/forms/topics-field"
import { ProgressBar, ProgressRing, dateRange } from "./learning-page"
import { kindInfo, kindOf, kindProgress, learningType } from "./learning-utils"

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

function CourseInfo({ course }: { course: Course }) {
  const info = kindInfo(kindOf(course))
  const range = dateRange(course)
  return (
    <Panel category="learning" title="Details" tool="course" command="info" meta={course.credits != null && info.value === "course" ? `${course.credits} credits` : undefined} bodyClassName="px-3.5 py-3">
      {info.value === "reading" && <div className="mb-3 border-b border-line-soft pb-3"><PagesRead key={course.pagesRead ?? -1} course={course} /></div>}
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
        {course.meetings?.map((m) => (
          <InfoRow key={m.id} icon={Clock} label={meetingKindLabel(m.kind)}>
            {daysLabel(m.days)} {formatTime(m.start)}–{formatTime(m.end)}{m.location ? ` · ${m.location}` : ""}
          </InfoRow>
        ))}
        {course.schedule && !course.meetings?.length && (
          <InfoRow icon={Clock} label="Schedule">
            {course.schedule}
          </InfoRow>
        )}
        {course.repoUrl && (
          <InfoRow icon={GitBranch} label="Class repo">
            <a href={course.repoUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{course.repoUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
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

/** Syllabus and policies live with the course, saved when you press Save. */
function CourseReference({ course }: { course: Course }) {
  const update = useWorkspace((s) => s.update)
  const [open, setOpen] = useState(false)
  const [syllabus, setSyllabus] = useState(course.syllabus ?? "")
  const [policies, setPolicies] = useState(course.policies ?? "")
  const dirty = syllabus !== (course.syllabus ?? "") || policies !== (course.policies ?? "")
  const has = [course.syllabus && "Syllabus", course.policies && "Policies"].filter(Boolean).join(" and ")
  return (
    <Panel category="learning" title="Syllabus and policies" tool="course" command="syllabus" bodyClassName={open ? "grid gap-3 px-3.5 py-3" : "px-3.5 py-2"}
      actions={<>
        {open && <Button size="sm" disabled={!dirty} onClick={() => { update("courses", course.id, { syllabus: syllabus.trim() || undefined, policies: policies.trim() || undefined }); toast.success("Saved") }}>Save</Button>}
        <Button size="sm" variant="quiet" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Hide" : has ? "Show" : "Add"}</Button>
      </>}>
      {open ? <>
        <label className="grid gap-1 text-xs text-muted-foreground">Syllabus<Textarea rows={5} value={syllabus} onChange={(e) => setSyllabus(e.target.value)} placeholder="Grading breakdown, weekly topics, what the class covers…" /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Policies<Textarea rows={3} value={policies} onChange={(e) => setPolicies(e.target.value)} placeholder="Late work, attendance, collaboration, how to reach the instructor…" /></label>
      </> : <p className="text-xs text-muted-foreground">{has ? `${has} saved.` : "Nothing added yet."}</p>}
    </Panel>
  )
}

function CourseNotes({ course }: { course: Course }) {
  const notes = useWorkspace((s) => s.notes)
  const create = useWorkspace((s) => s.create)
  const [text, setText] = useState("")
  const [noteModules, setNoteModules] = useState<string[]>([])
  const linked = notes.filter((n) => n.courseId === course.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const add = () => {
    if (!text.trim()) return
    create("notes", { text: text.trim(), color: "blue", pinned: false, courseId: course.id, topicIds: noteModules.length ? noteModules : undefined })
    setText("")
    setNoteModules([])
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
          rows={4}
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
        {!!course.topics?.length && <div className="grid gap-1"><span className="text-[11px] text-muted-foreground">Module (optional)</span><TopicChips topics={course.topics} value={noteModules} onChange={setNoteModules} /></div>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-faint">Also on the Notes page · ⌘/Ctrl + Enter</span>
          <Button type="submit" size="sm" disabled={!text.trim()}>
            <Plus /> Add note
          </Button>
        </div>
      </form>
      {linked.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2" aria-label="Notes for this course">
          {linked.map((n) => (
            <StickyNote key={n.id} note={n} compact />
          ))}
        </ul>
      )}
    </Panel>
  )
}

type Section = "overview" | "work" | "notes"

/** The title, kind, code and term as labelled chips, then one progress line (ring, count, bar) for whatever the kind measures. */
function Identity({ course, items }: { course: Course; items: Task[] }) {
  const info = kindInfo(kindOf(course))
  const p = kindProgress(course, items)
  return (
    <div data-category={`kind-${info.value}`} className="mb-3 grid gap-2.5">
      <div className="flex items-stretch gap-2.5">
        <span className="w-1 shrink-0 rounded-[2px] bg-[var(--bw-category)]" aria-hidden />
        <div className="grid min-w-0 gap-1.5">
          <h2 className="truncate font-heading text-[17px] leading-tight font-bold text-ink">{course.title}</h2>
          <div className="flex flex-wrap gap-1">
            <PropChip kind="course" value={info.label.toUpperCase()} />
            {course.code && <PropChip kind="neutral" label="Code" value={course.code} />}
            {course.term && <PropChip kind="neutral" label="Term" value={course.term} />}
            {course.instructor && info.person && <PropChip kind="neutral" label={info.person[0]} value={course.instructor} />}
            {p.best != null && <PropChip kind="status" label="Best practice test" value={`${p.best}%`} />}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-[8px] border border-line-soft bg-panel px-3 py-2">
        {p.measured ? <ProgressRing pct={p.pct} label={`${course.title} progress`} size={44} /> : <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line-soft text-faint" aria-hidden>–</span>}
        <div className="grid min-w-0 flex-1 gap-1.5">
          <span className="text-[13px] text-ink-2">{p.summary}{p.overdue > 0 && <span className="ml-2 font-semibold text-amber">{p.overdue} overdue</span>}</span>
          {p.measured && <ProgressBar pct={p.pct} label={`${info.label} progress`} />}
        </div>
      </div>
    </div>
  )
}

export function CourseDetail() {
  const { id = "" } = useParams()
  const course = useWorkspace((s) => s.courses.find((c) => c.id === id))
  const tasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)
  const noteCount = useWorkspace((s) => s.notes.filter((n) => n.courseId === id).length)
  const [params, setParams] = useSearchParams()
  const asked = params.get("tab")
  const section: Section = asked === "overview" || asked === "work" || asked === "notes" ? asked : course?.kind === "reading" ? "overview" : "work"
  const choose = (next: Section) => setParams((p) => { const n = new URLSearchParams(p); n.set("tab", next); return n }, { replace: true })

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
  const kind = kindOf(course)

  return (
    <>
      <PageHeader
        back={{ to: `${learningHref}?view=library`, label: "Library" }}
        title={course.title}
        badge={<KindIcon kind={kind} small />}
        actions={
          <>
            <Button variant="ghost" onClick={() => openForm({ kind: "course", id: course.id })}>
              <Pencil /> Edit
            </Button>
            <AddItem course={course} />
          </>
        }
      />
      <Identity course={course} items={items} />
      <div className="mb-3">
        <SegmentedTabs<Section> label="Learning item sections" value={section} onChange={choose} className="max-w-full overflow-x-auto" tabs={[{ value: "overview", label: "Overview" }, { value: "work", label: "Work", count: items.filter((t) => !t.done).length }, { value: "notes", label: "Notes", count: noteCount }]} />
      </div>
      {section === "work" ? <WorkView key={course.id} course={course} items={items} /> : section === "notes" ? <CourseNotes course={course} /> : (
        <WorkspaceGrid>
          <GridItem span={2}><CourseInfo course={course} /></GridItem>
          <GridItem><TopicsPanel course={course} /></GridItem>
          {kind === "course" && <GridItem span={2}><CourseReference key={course.id} course={course} /></GridItem>}
        </WorkspaceGrid>
      )}
    </>
  )
}
