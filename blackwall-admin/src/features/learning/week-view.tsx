import { addDays, format, startOfWeek } from "date-fns"
import { CalendarPlus, ChevronLeft, ChevronRight, Flag, GraduationCap } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { parseKey, toDateKey, weekStart } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { useCourseMap, useWorkspace } from "@/stores/workspace"
import { applyFocusPlan } from "@shared/records"
import { planWeek, weekLoad, type DayLoad } from "@shared/learning"
import { CourseTag } from "./coursework"

const LOAD: Record<DayLoad, { label: string; cls: string }> = {
  light: { label: "Light", cls: "text-muted-foreground" },
  busy: { label: "Busy", cls: "text-amber" },
  heavy: { label: "Heavy", cls: "text-red" },
}

/** One plain-language plan: which day to work on what, for you to accept, tweak or skip. */
function PlanWeek({ today }: { today: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const courseMap = useCourseMap()
  const [off, setOff] = useState<Set<string>>(new Set())
  const perDay = usePrefs((st) => st.planPerDay)
  const horizon = usePrefs((st) => st.planHorizon)
  const proposals = planWeek({ tasks, courses }, today, horizon, perDay)
  const chosen = proposals.filter((p) => !off.has(p.task.id))
  const apply = () => {
    useWorkspace.setState((s) => applyFocusPlan({ tasks: s.tasks }, chosen.map((p) => ({ id: p.task.id, date: p.date }))))
    toast.success(`${chosen.length} item${chosen.length === 1 ? "" : "s"} added to your days`)
    setOff(new Set())
  }
  return (
    <Panel category="learning" title={`Plan my next ${horizon / 7} week${horizon === 7 ? "" : "s"}`} tool="learning" command="plan" meta={proposals.length || undefined}
      actions={proposals.length ? <Button size="sm" disabled={!chosen.length} onClick={apply}><CalendarPlus /> Add {chosen.length} to my days</Button> : undefined}>
      {proposals.length ? (
        <>
          <p className="border-b border-line-soft px-3.5 py-2 text-[11px] text-muted-foreground">Each one goes on a day a few days before it is due, never more than {perDay} a day. They show in Today's focus in the Planner. Untick what you'd rather plan yourself.</p>
          <ul>
            {proposals.map((p) => (
              <li key={p.task.id} className="flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0">
                <Checkbox checked={!off.has(p.task.id)} aria-label={`Plan ${p.task.title}`} onCheckedChange={(on) => setOff((s) => { const n = new Set(s); if (on) n.delete(p.task.id); else n.add(p.task.id); return n })} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{p.task.title}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CourseTag course={courseMap.get(p.task.courseId!)} asLink={false} className="h-[18px] text-[10px]" />{p.why}</span>
                </span>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink-2">{p.date === today ? "Today" : format(parseKey(p.date), "EEE, MMM d")}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState icon={GraduationCap} title="Nothing left to plan">Everything due in the next two weeks already has a day, or there is nothing due. New assignments show up here.</EmptyState>
      )}
    </Panel>
  )
}

export function WeekView({ today }: { today: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const openForm = useUi((s) => s.openForm)
  const [offset, setOffset] = useState(0)
  const first = addDays(startOfWeek(parseKey(today), { weekStartsOn: weekStart() }), offset * 7)
  const days = weekLoad({ tasks, courses }, toDateKey(first))
  return (
    <div className="grid gap-3">
      <Panel category="calendar" title={`${format(first, "MMM d")} – ${format(addDays(first, 6), "MMM d, yyyy")}`} tool="learning" command="week"
        actions={<><Button variant="outline" size="xs" disabled={offset === 0} onClick={() => setOffset(0)}>This week</Button><Button variant="quiet" size="icon-sm" aria-label="Previous week" onClick={() => setOffset(offset - 1)}><ChevronLeft /></Button><Button variant="quiet" size="icon-sm" aria-label="Next week" onClick={() => setOffset(offset + 1)}><ChevronRight /></Button></>}
        bodyClassName="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2 p-2.5">
        {days.map((d) => (
          <section key={d.date} aria-label={format(parseKey(d.date), "EEEE, MMMM d")} className={cn("grid content-start gap-1.5 rounded-lg border border-line-soft bg-well p-2", d.date === today && "border-[var(--bw-blue,#64b5f6)]")} data-load={d.load}>
            <header className="flex items-baseline gap-1.5">
              <strong className="text-[13px] text-ink">{format(parseKey(d.date), "EEE d")}</strong>
              <span className={cn("ml-auto text-[10px] font-semibold uppercase tracking-wide", LOAD[d.load].cls)}>{LOAD[d.load].label}</span>
            </header>
            {d.classes > 0 && <p className="text-[11px] text-muted-foreground">{d.classes} class{d.classes === 1 ? "" : "es"} · {(d.classMinutes / 60).toFixed(d.classMinutes % 60 ? 1 : 0)}h</p>}
            {d.due.map((t) => (
              <button key={t.id} type="button" onClick={() => openForm({ kind: "task", id: t.id })} className="flex items-start gap-1 rounded-[5px] bg-raised px-1.5 py-1 text-left text-[11px] text-ink hover:bg-[var(--bw-selected,#243e60)]">
                <Flag className={cn("mt-0.5 size-3 shrink-0", t.learningType === "exam" ? "text-red" : "text-amber")} aria-hidden /><span className="min-w-0 break-words">{t.title}</span>
              </button>
            ))}
            {d.focus.filter((t) => t.due !== d.date).map((t) => (
              <button key={t.id} type="button" onClick={() => openForm({ kind: "task", id: t.id })} className="rounded-[5px] border border-dashed border-line px-1.5 py-1 text-left text-[11px] text-ink-2 hover:bg-raised">Work on: {t.title}</button>
            ))}
            {d.steps.map(({ task, step }) => (
              <button key={step.id} type="button" onClick={() => openForm({ kind: "task", id: task.id })} className="rounded-[5px] border border-dashed border-line px-1.5 py-1 text-left text-[11px] text-ink-2 hover:bg-raised" title={task.title}>Step: {step.title}</button>
            ))}
            {!d.classes && !d.due.length && !d.focus.length && !d.steps.length && <p className="text-[11px] text-faint">Free</p>}
          </section>
        ))}
      </Panel>
      <PlanWeek today={today} />
    </div>
  )
}
