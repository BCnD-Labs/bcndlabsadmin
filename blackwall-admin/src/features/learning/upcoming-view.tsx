import { format } from "date-fns"
import { CalendarDays, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { PropChip } from "@/components/common/prop-chip"
import { Button } from "@/components/ui/button"
import { daysUntil, parseKey } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import type { Course, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { compareCoursework, kindOf, learningType } from "./learning-utils"

type Row = { id: string; due: string; title: string; type: string; course?: Course; task?: Task }
type Group = "Overdue" | "Next 7 days" | "Later"
const GROUPS: { label: Group; tone: string }[] = [
  { label: "Overdue", tone: "text-[#ffadad]" },
  { label: "Next 7 days", tone: "text-[#ffcc80]" },
  { label: "Later", tone: "" },
]
const groupOf = (due: string): Group => { const d = daysUntil(due); return d < 0 ? "Overdue" : d <= 7 ? "Next 7 days" : "Later" }

/** MON / 17: the same date block the Home events list uses. */
export function DateBlock({ due }: { due: string }) {
  const date = parseKey(due)
  return (
    <span className="grid w-10 shrink-0 place-items-center rounded-[6px] bg-black/25 py-0.5 leading-none" aria-label={format(date, "MMMM d")}>
      <span className="font-mono text-[9px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{format(date, "MMM")}</span>
      <span className="text-[15px] font-semibold text-ink tabular-nums">{format(date, "d")}</span>
    </span>
  )
}

/** Dated learning work across every course: late first, then the week ahead, then later. Certification exam dates are rows too. */
export function UpcomingView() {
  const courses = useWorkspace((s) => s.courses)
  const tasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)
  const [selected, setSelected] = useState<string | null>(null)
  const known = new Map(courses.map((c) => [c.id, c]))
  const rows: Row[] = [
    ...tasks.filter((t) => t.courseId && known.has(t.courseId) && !t.done && t.due).sort(compareCoursework)
      .map((t) => ({ id: t.id, due: t.due!, title: t.title, type: learningType(t.learningType, known.get(t.courseId!)?.kind).label.toUpperCase(), course: known.get(t.courseId!), task: t })),
    ...courses.filter((c) => kindOf(c) === "certification" && c.endDate && daysUntil(c.endDate) >= 0)
      .map((c) => ({ id: `exam-${c.id}`, due: c.endDate!, title: `${c.title} exam date`, type: "EXAM DATE", course: c })),
  ].sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title))

  return (
    <div className="grid content-start gap-3">
      <div className="flex items-baseline justify-between px-1"><h2 className="text-sm font-semibold text-ink">Upcoming</h2><span className="text-xs text-muted-foreground">{rows.length} dated items</span></div>
      {GROUPS.map(({ label, tone }) => {
        const part = rows.filter((r) => groupOf(r.due) === label)
        if (!part.length) return null
        return (
          <Panel key={label} category="learning" title={label} tool="learning" command={label.toLowerCase()} count={part.length} headerClassName={tone}>
            <ul aria-label={label}>
              {part.map((r) => {
                const open = selected === r.id
                return (
                  <li key={r.id} className={cn("border-b border-line-soft border-l-[3px] last:border-b-0", open ? "border-l-[var(--bw-blue)] bg-selected" : "border-l-transparent hover:bg-raised")}>
                    <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Preview"} ${r.title}`} onClick={() => setSelected(open ? null : r.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
                      <DateBlock due={r.due} />
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="truncate text-[13px] font-semibold text-ink">{r.title}</span>
                        <span className="flex flex-wrap gap-1"><PropChip kind="tag" value={r.type} />{r.course && <PropChip kind="course" label="Course" value={r.course.title} />}</span>
                      </span>
                      {open ? <ChevronUp className="size-4 shrink-0 text-faint" aria-hidden /> : <ChevronDown className="size-4 shrink-0 text-faint" aria-hidden />}
                    </button>
                    {open && (
                      <div className="grid gap-2 px-3 pb-2.5 pl-[3.75rem]">
                        {r.task?.details && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{r.task.details.replace(/\s+/g, " ")}</p>}
                        {r.task
                          ? <Button size="xs" className="w-fit rounded-full" onClick={() => openForm({ kind: "task", id: r.task!.id })}><ExternalLink /> Open</Button>
                          : r.course && <Button asChild size="xs" className="w-fit rounded-full"><Link to={courseHref(r.course.id)}><ExternalLink /> Open</Link></Button>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>
        )
      })}
      {!rows.length && <Panel category="learning" title="Upcoming" tool="learning" command="upcoming"><EmptyState icon={CalendarDays} title="No dated learning work yet">Add a deadline or schedule a session to see it here.</EmptyState></Panel>}
    </div>
  )
}
