import { format } from "date-fns"
import { ChevronDown, ChevronUp, ExternalLink, GraduationCap } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/common/empty-state"
import { SearchField } from "@/components/common/list"
import { Panel } from "@/components/common/panel"
import { PropChip, type ChipKind } from "@/components/common/prop-chip"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { Button } from "@/components/ui/button"
import { parseKey, todayKey } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import type { Course, LearningKind, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { KINDS, kindInfo, kindOf, kindProgress } from "./learning-utils"

type KindFilter = LearningKind | "all"
const day = (key: string) => format(parseKey(key), "MMM d")
const isEvent = (t: Task) => t.kind === "event" || t.learningType === "event"
const SOURCE: Record<LearningKind, string> = { course: "Source", certification: "Vendor", selfpaced: "Source", skill: "Source", reading: "Author" }

/** The next open, dated piece of work (sessions and events don't count). */
const nextWork = (items: Task[]) => items.filter((t) => !t.done && !isEvent(t) && t.due).sort((a, b) => a.due!.localeCompare(b.due!))[0]

/** What the preview shows: every filled-in fact as a labelled chip, so nothing needs the form to read. */
function peekChips(course: Course, items: Task[], notes: number): { key: string; kind: ChipKind; label?: string; value: string }[] {
  const kind = kindOf(course)
  const when = [course.startDate && day(course.startDate), course.endDate && day(course.endDate)].filter(Boolean).join(" – ")
  const chips: ({ key: string; kind: ChipKind; label?: string; value: string } | undefined)[] = [
    course.instructor ? { key: "source", kind: "neutral", label: SOURCE[kind], value: course.instructor } : undefined,
    course.term ? { key: "term", kind: "neutral", label: "Term", value: course.term } : undefined,
    when ? { key: "when", kind: "date", label: kind === "certification" ? "Exam" : "When", value: when } : undefined,
    course.schedule ? { key: "schedule", kind: "neutral", label: "Schedule", value: course.schedule } : undefined,
    course.location ? { key: "where", kind: "neutral", label: "Where", value: course.location } : undefined,
    ...course.tags.map((tag) => ({ key: `tag-${tag}`, kind: "tag" as const, label: "Tag", value: tag })),
    { key: "open", kind: "status", label: "Open", value: String(items.filter((t) => !t.done).length) },
    notes ? { key: "notes", kind: "neutral", label: "Notes", value: String(notes) } : undefined,
    course.links?.length ? { key: "links", kind: "neutral", label: "Links", value: String(course.links.length) } : undefined,
  ]
  return chips.filter((x): x is NonNullable<typeof x> => !!x)
}

function LibraryRow({ course, items, notes, open, onToggle }: { course: Course; items: Task[]; notes: number; open: boolean; onToggle: () => void }) {
  const info = kindInfo(kindOf(course))
  const p = kindProgress(course, items)
  const next = nextWork(items)
  const today = todayKey()
  return (
    <li data-category={`kind-${info.value}`} data-testid="library-row" className={cn("border-b border-line-soft border-l-[3px] border-l-[var(--bw-category)] last:border-b-0", open ? "bg-selected" : "hover:bg-raised")}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Hide" : "Preview"} ${course.title}. ${p.summary}`} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-[14px] font-semibold text-ink">{course.title}</span>
          <span className="flex flex-wrap items-center gap-1">
            <span className="inline-flex h-5 items-center rounded-[5px] bg-[color-mix(in_srgb,var(--bw-category)_16%,transparent)] px-1.5 font-mono text-[10px] font-bold tracking-[0.06em] text-[var(--bw-category)] uppercase">{info.label}</span>
            {course.code && <PropChip kind="neutral" label="Code" value={course.code} />}
            {next && <PropChip kind={next.due! < today ? "overdue" : "date"} label="Next" value={day(next.due!)} />}
          </span>
        </span>
        <span className="flex w-52 shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate tabular-nums">{p.summary}</span>
          {p.measured && <>
            <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-off" aria-hidden><span className="block h-full bg-[var(--bw-category)]" style={{ width: `${p.pct}%` }} /></span>
            <span className="w-9 shrink-0 text-right font-semibold text-[var(--bw-category)] tabular-nums">{p.pct}%</span>
          </>}
        </span>
        {open ? <ChevronUp className="size-4 shrink-0 text-faint" aria-hidden /> : <ChevronDown className="size-4 shrink-0 text-faint" aria-hidden />}
      </button>
      {open && (
        <div className="grid gap-2 px-3 pt-0.5 pb-2.5 pl-4">
          {course.description && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{course.description.replace(/\s+/g, " ")}</p>}
          <div className="flex flex-wrap gap-1">{peekChips(course, items, notes).map((c) => <PropChip key={c.key} kind={c.kind} label={c.label} value={c.value} />)}</div>
          <Button asChild size="xs" className="w-fit rounded-full"><Link to={courseHref(course.id)}><ExternalLink /> Open</Link></Button>
        </div>
      )}
    </li>
  )
}

/** Everything you're learning as one compact list. Pick a row to preview it, Open to go in. */
export function LibraryView() {
  const courses = useWorkspace((s) => s.courses)
  const tasks = useWorkspace((s) => s.tasks)
  const notes = useWorkspace((s) => s.notes)
  const openForm = useUi((s) => s.openForm)
  const [kind, setKind] = useState<KindFilter>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const needle = search.trim().toLowerCase()
  const shown = courses.filter((c) => (kind === "all" || kindOf(c) === kind) && [c.title, c.code, c.instructor, ...c.tags].join(" ").toLowerCase().includes(needle))
  const count = (k: KindFilter) => k === "all" ? courses.length : courses.filter((c) => kindOf(c) === k).length

  return (
    <div className="grid content-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} label="Find learning…" className="sm:w-64" />
        <SegmentedTabs<KindFilter> label="Show kind" value={kind} onChange={setKind} className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none]" tabClassName="flex-none px-3"
          tabs={[{ value: "all", label: "All", count: count("all") }, ...KINDS.map((k) => ({ value: k.value as KindFilter, label: k.label, count: count(k.value) }))]} />
      </div>
      <Panel category="learning" title="Library" tool="learning" command="ls" count={`${shown.length} ${shown.length === 1 ? "item" : "items"}`}>
        {shown.length ? (
          <ul>{shown.map((c) => <LibraryRow key={c.id} course={c} items={tasks.filter((t) => t.courseId === c.id)} notes={notes.filter((n) => n.courseId === c.id).length} open={selected === c.id} onToggle={() => setSelected((id) => id === c.id ? null : c.id)} />)}</ul>
        ) : (
          <EmptyState roomy icon={GraduationCap} title={courses.length ? "No matches" : "Your learning library is empty"}
            action={courses.length ? undefined : <Button variant="outline" onClick={() => openForm({ kind: "course" })}>+ Add learning</Button>}>
            {courses.length ? "Try a different search or kind." : "Add a course, certification, skill, book, or self-paced track."}
          </EmptyState>
        )}
      </Panel>
      {shown.length > 0 && <p className="px-1 text-[11px] text-faint">Progress reflects finished work, milestones, or pages, according to the learning item.</p>}
    </div>
  )
}
