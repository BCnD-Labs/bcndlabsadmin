import { useEffect, useMemo, useState } from "react"
import { addDays, format, isToday } from "date-fns"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Check, ChevronLeft, ChevronRight, ListChecks, Plus, Star } from "lucide-react"
import { Panel } from "@/components/common/panel"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseKey, toDateKey, todayKey } from "@/lib/dates"
import type { Task } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { validDateKey } from "@shared/planner"
import { addDaysToKey } from "@shared/date-keys"
import { isMeetingId, meetingCourseId, meetingEvents } from "@shared/learning"
import { courseHref } from "@/lib/routes"
import { LOG_PROMPTS, appendPrompt } from "@/features/journal/log-helpers"
import { JournalGlance } from "@/features/journal/journal-glance"
import { ScheduleCalendar } from "./schedule-calendar"
import { PlannerNotes } from "./planner-notes"
import { TaskBrowser } from "./task-browser"
import { TaskInspector, type InspectorTab } from "./task-inspector"
import { PlannerSaveState } from "./planner-save-state"
import { reflectionSummary } from "./planner-utils"
import "./planner.css"

/** Approved canvas: calendar above Notes + Daily log; inspector spans the right. */
export function PlannerPage() {
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const date = validDateKey(params.get("date")) ? params.get("date")! : todayKey()
  const selected = tasks.find((task) => task.id === params.get("task"))
  // Weekly class times draw on the calendar without being saved as records; tapping one opens its course.
  const showClassTimes = usePrefs((st) => st.showClassTimes)
  const calendarItems = useMemo(() => (showClassTimes ? [...tasks, ...meetingEvents(courses, addDaysToKey(date, -45)!, addDaysToKey(date, 45)!)] : tasks), [tasks, courses, date, showClassTimes])
  const [tab, setTab] = useState<InspectorTab>("details")
  const [browserOpen, setBrowserOpen] = useState(false)
  const openForm = useUi((s) => s.openForm)
  const setDate = (value: string) => {
    const next = new URLSearchParams(params)
    next.set("date", value)
    navigate({ search: next.toString(), hash: "" }, { replace: true })
  }
  const select = (task: Task, reflection = false) => {
    if (isMeetingId(task.id)) { const course = meetingCourseId(task.id); if (course) navigate(courseHref(course)); return }
    const next = new URLSearchParams(params)
    next.set("task", task.id)
    setParams(next, { replace: true })
    setTab(reflection ? "reflection" : "details")
    setBrowserOpen(false)
    if (reflection) requestAnimationFrame(() => document.getElementById("reflection-text")?.focus())
  }
  const noteParam = params.get("note")
  useEffect(() => {
    if (!noteParam) return
    if (useWorkspace.getState().notes.some((note) => note.id === noteParam)) openForm({ kind: "note", id: noteParam })
    const next = new URLSearchParams(params); next.delete("note"); setParams(next, { replace: true })
  }, [noteParam, params, setParams, openForm])
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
  }, [hash])

  return <>
    <PageHeader title="Planner" actions={<Button onClick={() => openForm({ kind: "task", defaults: { due: date } })}><Plus /> Task</Button>} />
    <div className="planner-workspace" data-testid="planner">
      <div id="tasks" className="planner-focus" aria-label="Daily focus">
        <h2 className="shrink-0 text-sm font-semibold">{date === todayKey() ? "Today's focus" : `Focus · ${format(parseKey(date), "MMM d")}`}</h2>
        <FocusItems date={date} onSelect={(task) => select(task)} onComplete={(task) => select(task, true)} />
        <Popover open={browserOpen || hash === "#tasks"} onOpenChange={(open) => { setBrowserOpen(open); if (!open && hash === "#tasks") navigate({ search: params.toString(), hash: "" }, { replace: true }) }}><PopoverTrigger asChild><Button variant="outline" size="sm"><ListChecks /> Tasks</Button></PopoverTrigger><PopoverContent align="end" className="w-[min(480px,calc(100vw-24px))] p-0"><TaskBrowser date={date} onSelect={(task) => select(task)} onComplete={(task) => select(task, true)} /></PopoverContent></Popover>
      </div>
      <div className="planner-canvas">
        <ScheduleCalendar date={date} onDate={setDate} tasks={calendarItems} selected={selected?.id} onSelect={(task) => select(task)} />
        <section className="bw-panel planner-notes" aria-label="Notes"><PlannerNotes /></section>
        <DailyLog date={date} onDate={setDate} onSelect={(task) => select(task, true)} />
        <TaskInspector task={selected} date={date} tab={tab} onTab={setTab} onDate={setDate} onSelect={(task) => select(task)} />
      </div>
    </div>
  </>
}

function FocusItems({ date, onSelect, onComplete }: { date: string; onSelect: (task: Task) => void; onComplete: (task: Task) => void }) {
  const tasks = useWorkspace((s) => s.tasks)
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const focus = tasks.filter((task) => task.focusDate === date)
  return <div className="planner-focus-items">
    {focus.length ? focus.map((task) => <div key={task.id} className="planner-focus-item">
      <Checkbox checked={task.done} aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`} onCheckedChange={() => { toggleTask(task.id); if (!task.done) onComplete(task) }} />
      <button type="button" onClick={() => onSelect(task)} className="min-w-0 text-left text-xs"><span className={task.done ? "text-green" : "text-ink"}>{task.title}</span><span className="ml-2 text-muted-foreground">{task.done ? "Done" : task.due ? `Due ${format(parseKey(task.due), "MMM d")}` : "No deadline"}</span></button>
      {task.starred && <Star className="size-3 shrink-0 fill-current text-amber" />}
    </div>) : <span className="text-xs text-muted-foreground">Choose a task, then add it to this day's focus in Details.</span>}
  </div>
}

function DailyLog({ date, onDate, onSelect }: { date: string; onDate: (date: string) => void; onSelect: (task: Task) => void }) {
  const entry = useWorkspace((s) => s.journal.find((value) => value.id === date))
  const tasks = useWorkspace((s) => s.tasks)
  const saveJournal = useWorkspace((s) => s.saveJournal)
  const completed = tasks.filter((task) => task.done && task.completedAt && toDateKey(new Date(task.completedAt)) === date)
  const day = parseKey(date)
  return <Panel id="day" category="journal" title="Daily log" className="planner-daily-log" subtitle={format(day, "EEE, MMM d, yyyy")} actions={<>
    <Button variant="quiet" size="icon-sm" aria-label="Previous log day" onClick={() => onDate(toDateKey(addDays(day, -1)))}><ChevronLeft /></Button>
    <Button variant="outline" size="xs" disabled={isToday(day)} onClick={() => onDate(todayKey())}>Today</Button>
    <Button variant="quiet" size="icon-sm" aria-label="Next log day" onClick={() => onDate(toDateKey(addDays(day, 1)))}><ChevronRight /></Button>
  </>} bodyClassName="flex flex-col gap-2 p-3">
    <label htmlFor="planner-log" className="sr-only">Daily log for {date}</label>
    <textarea id="planner-log" value={entry?.text ?? ""} onChange={(e) => saveJournal(date, e.target.value)} placeholder="What happened? A few lines are enough." className="planner-log-text" />
    <div className="flex flex-wrap gap-1">{LOG_PROMPTS.map((prompt) => <Button key={prompt} variant="quiet" size="xs" onClick={() => { saveJournal(date, appendPrompt(entry?.text ?? "", prompt)); requestAnimationFrame(() => { const el = document.getElementById("planner-log") as HTMLTextAreaElement | null; el?.focus(); if (el) el.setSelectionRange(el.value.length, el.value.length) }) }}>+ {prompt}</Button>)}</div>
    <JournalGlance date={date} />
    {entry && <div className="flex items-center gap-2"><PlannerSaveState /><span className="text-[11px] text-muted-foreground">{format(new Date(entry.updatedAt), "HH:mm")}</span></div>}
    {!!completed.length && <details className="border-t border-line-soft pt-2"><summary className="cursor-pointer text-xs text-muted-foreground">{completed.length} completed this day</summary><ul className="mt-1 space-y-1">{completed.map((task) => <li key={task.id}><button className="flex w-full items-start gap-2 rounded p-1 text-left text-xs hover:bg-raised" onClick={() => onSelect(task)}><Check className="mt-0.5 size-3 shrink-0 text-green" /><span><strong className="font-medium">{task.title}</strong><span className="mt-0.5 block text-muted-foreground">{reflectionSummary(task) || "Add a reflection"}</span></span></button></li>)}</ul></details>}
  </Panel>
}
