import { format } from "date-fns"
import { ChevronDown, ChevronUp, ExternalLink, ListChecks, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { PropChip } from "@/components/common/prop-chip"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { daysUntil, parseKey } from "@/lib/dates"
import { parseQuickAdd } from "@/lib/quick-add"
import type { Course, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { statusLabel, statusOf } from "@shared/learning"
import { stepProgress } from "@shared/steps"
import { ModuleChip } from "./module-chip"
import { StatusPill, tracksStatus } from "./status-pill"
import { compareCoursework, kindInfo, kindOf, learningType } from "./learning-utils"

type Show = "open" | "done" | "all"
const day = (key: string) => format(parseKey(key), "MMM d")
const TITLES: Record<string, string> = { course: "work", certification: "study", selfpaced: "sections", skill: "milestones", reading: "chapters" }

function WorkRow({ task, course, byModule, open, onToggle }: { task: Task; course: Course; byModule: boolean; open: boolean; onToggle: () => void }) {
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const openForm = useUi((s) => s.openForm)
  const type = learningType(task.learningType, course.kind)
  const overdue = !task.done && !!task.due && daysUntil(task.due) < 0
  const modules = (course.topics ?? []).filter((m) => task.topicIds?.includes(m.id))
  const steps = task.subtasks?.length ? stepProgress(task) : undefined
  const status = tracksStatus(task, course) ? statusOf(task) : "not_started"
  return (
    <li className={cn("border-b border-line-soft border-l-[3px] last:border-b-0", open ? "border-l-[var(--bw-category)] bg-selected" : "border-l-transparent hover:bg-raised")} data-testid="work-row">
      <div className="flex items-center gap-2.5 px-3 py-1.5">
        <Checkbox checked={task.done} onCheckedChange={() => toggleTask(task.id)} aria-label={task.done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`} />
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Hide" : "Preview"} ${task.title}`} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="grid min-w-0 flex-1 gap-1">
            <span className={cn("line-clamp-2 text-[13px] leading-snug font-semibold text-ink", task.done && "text-faint line-through")}>{task.title}</span>
            <span className="flex flex-wrap gap-1">
              <PropChip kind="tag" value={type.label} />
              {task.due && <PropChip kind={overdue ? "overdue" : "date"} label="Due" value={day(task.due)} />}
              {task.workType && <PropChip kind="neutral" value={task.workType.toUpperCase()} />}
              {!byModule && modules.length > 0 && <PropChip kind="tag" label="Module" value={modules[0].title + (modules.length > 1 ? ` +${modules.length - 1}` : "")} />}
              {task.score != null && <PropChip kind="status" label="Score" value={`${task.score}%`} />}
              {steps && <PropChip kind="neutral" label="Steps" value={`${steps.done}/${steps.total}`} />}
              {status !== "not_started" && <PropChip kind="status" value={statusLabel(status).toUpperCase()} />}
            </span>
          </span>
          {open ? <ChevronUp className="size-4 shrink-0 text-faint" aria-hidden /> : <ChevronDown className="size-4 shrink-0 text-faint" aria-hidden />}
        </button>
      </div>
      {open && (
        <div className="grid gap-2 pr-3 pb-2.5 pl-[2.6rem]">
          {task.details && <p className="line-clamp-3 text-xs leading-snug text-muted-foreground">{task.details.replace(/\s+/g, " ")}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="xs" className="rounded-full" onClick={() => openForm({ kind: "task", id: task.id })}><ExternalLink /> Open</Button>
            {tracksStatus(task, course) && <StatusPill task={task} />}
            <ModuleChip task={task} course={course} />
          </div>
        </div>
      )}
    </li>
  )
}

/** A course's work in one panel: open, done or all, grouped by module (with a + that adds into it) or by date. */
export function WorkView({ course, items }: { course: Course; items: Task[] }) {
  const create = useWorkspace((s) => s.create)
  const openForm = useUi((s) => s.openForm)
  const info = kindInfo(kindOf(course))
  const first = info.types[0]
  const modules = course.topics ?? []
  const [show, setShow] = useState<Show>("open")
  const [by, setBy] = useState<"module" | "date">(modules.length ? "module" : "date")
  const [selected, setSelected] = useState<string | null>(null)
  const [quick, setQuick] = useState("")
  const byModule = by === "module" && modules.length > 0
  const open = items.filter((t) => !t.done).sort(compareCoursework)
  const done = items.filter((t) => t.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
  const pool = show === "done" ? done : show === "all" ? [...open, ...done] : open
  const placed = new Set<string>()
  const groups = [
    ...modules.map((m) => {
      const mine = pool.filter((t) => t.topicIds?.includes(m.id) && !placed.has(t.id))
      mine.forEach((t) => placed.add(t.id))
      const all = items.filter((t) => t.topicIds?.includes(m.id))
      return { id: m.id, label: m.title, note: all.length ? `${all.filter((t) => t.done).length} of ${all.length} done` : "no work yet", rows: mine }
    }),
    { id: "", label: "No module", note: undefined as string | undefined, rows: pool.filter((t) => !placed.has(t.id)) },
  ].filter((g) => g.rows.length || g.id)
  const title = `${show === "open" ? "Open" : show === "done" ? "Finished" : "All"} ${TITLES[info.value]}`

  const rowFor = (t: Task) => <WorkRow key={t.id} task={t} course={course} byModule={byModule} open={selected === t.id} onToggle={() => setSelected((id) => id === t.id ? null : t.id)} />
  const add = () => {
    const { title: text, due } = parseQuickAdd(quick)
    if (!text) return
    create("tasks", { title: text, due, courseId: course.id, learningType: first.value, starred: false, done: false })
    setQuick("")
    toast.success(due ? `${first.label} added for ${due}` : `${first.label} added`)
  }

  return (
    <div className="grid content-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {modules.length > 0 && <SegmentedTabs label="Group work" value={by} onChange={setBy} tabClassName="px-3" tabs={[{ value: "module", label: "By module" }, { value: "date", label: "By date" }]} />}
        <SegmentedTabs label={`Show ${TITLES[info.value]}`} value={show} onChange={(v) => { setSelected(null); setShow(v) }} tabClassName="px-3"
          tabs={[{ value: "open", label: "Open", count: open.length }, { value: "done", label: "Done", count: done.length }, { value: "all", label: "All", count: items.length }]} />
        <form className="ml-auto flex min-w-[14rem] flex-1 items-center gap-2 rounded-[8px] border border-line-soft bg-well px-2.5 sm:max-w-sm" onSubmit={(e) => { e.preventDefault(); add() }}>
          <Plus className="size-3.5 shrink-0 text-faint" aria-hidden />
          <label htmlFor="course-quick-add" className="sr-only">Add {first.label.toLowerCase()}</label>
          <input id="course-quick-add" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={`Add ${first.label.toLowerCase()} · end with “fri” for a date`} className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint" />
          {quick.trim() && <Button type="submit" size="xs">Add</Button>}
        </form>
      </div>
      <Panel category="learning" title={title} tool={course.code ? course.code.toLowerCase().replace(/\s+/g, "") : "course"} command="work" count={pool.length}>
        {byModule ? groups.map((g) => (
          <section key={g.id || "none"} aria-label={g.label}>
            <div className="flex min-h-9 items-center gap-2 border-b border-line-soft bg-[color-mix(in_srgb,var(--bw-category)_14%,var(--bw-panel))] px-3">
              <h3 className="min-w-0 flex-1 truncate text-[11px] font-bold tracking-[0.04em] text-ink uppercase">{g.label}</h3>
              {g.note && <span className="text-[11px] text-muted-foreground">{g.note}</span>}
              {g.id && <Button variant="quiet" size="icon-xs" aria-label={`Add work to ${g.label}`} title={`Add work to ${g.label}`} onClick={() => openForm({ kind: "task", defaults: { courseId: course.id, learningType: first.value, topicIds: [g.id] } })}><Plus /></Button>}
            </div>
            <ul>{g.rows.map(rowFor)}</ul>
          </section>
        )) : pool.length ? <ul>{pool.map(rowFor)}</ul> : (
          <EmptyState icon={ListChecks} title={show === "done" ? "Nothing finished yet" : "No work here yet"}>
            {show === "done" ? "Check items off and they land here." : "Add a step above when you're ready."}
          </EmptyState>
        )}
      </Panel>
    </div>
  )
}
