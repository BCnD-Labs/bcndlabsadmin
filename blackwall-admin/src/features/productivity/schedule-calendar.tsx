import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { addDays, addMonths, addWeeks, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns"
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { Button } from "@/components/ui/button"
import { parseKey, toDateKey, todayKey, weekStart } from "@/lib/dates"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { useUi } from "@/stores/ui"
import { taskOnDate, taskSlot, timedLanes } from "./planner-utils"

type View = "day" | "week" | "month"
const HOUR = 44

export function ScheduleCalendar({ date, onDate, tasks, selected, onSelect }: {
  date: string; onDate: (date: string) => void; tasks: Task[]; selected?: string; onSelect: (task: Task) => void
}) {
  const journal = useWorkspace((state) => state.journal)
  const [view, setView] = useState<View>("week")
  const day = parseKey(date)
  const first = startOfWeek(day, { weekStartsOn: weekStart() })
  const days = view === "day" ? [day] : Array.from({ length: 7 }, (_, index) => addDays(first, index))
  const gridStart = startOfWeek(startOfMonth(day), { weekStartsOn: weekStart() })
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  const scroll = useRef<HTMLDivElement>(null)
  const title = view === "month" ? format(day, "MMMM yyyy") : view === "day" ? format(day, "EEEE, MMM d") : `${format(first, "MMM d")} – ${format(addDays(first, 6), "MMM d, yyyy")}`
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 10 * HOUR }, [view, date])
  const move = (direction: number) => onDate(toDateKey(view === "month" ? addMonths(day, direction) : view === "week" ? addWeeks(day, direction) : addDays(day, direction)))
  const add = (key: string, time?: string) => useUi.getState().openForm({ kind: "task", defaults: { due: key, time } })
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = toDateKey(addDays(parseKey(key), step))
    onDate(next)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-planner-date="${next}"]`)?.focus())
  }
  const toolbar = <>
    <Button variant="outline" size="xs" onClick={() => onDate(todayKey())}>Today</Button>
    <Button variant="quiet" size="icon-sm" aria-label={`Previous ${view}`} onClick={() => move(-1)}><ChevronLeft /></Button>
    <Button variant="quiet" size="icon-sm" aria-label={`Next ${view}`} onClick={() => move(1)}><ChevronRight /></Button>
    <SegmentedTabs label="Calendar view" value={view} onChange={setView} className="w-44" tabs={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
  </>

  return <Panel id="calendar" category="calendar" title={title} actions={toolbar} className="planner-calendar" bodyClassName="overflow-hidden">
    {view === "month" ? <div className="planner-month" role="group" aria-label="Month calendar">
      <div className="planner-month-labels">{Array.from({ length: 7 }, (_, i) => <span key={i}>{format(addDays(gridStart, i), "EEE")}</span>)}</div>
      <div className="planner-month-days">{monthDays.map((value) => {
        const key = toDateKey(value)
        const items = tasks.filter((task) => taskOnDate(task, key))
        const logged = journal.some((entry) => entry.id === key && entry.text.trim())
        const completed = tasks.filter((task) => task.done && task.completedAt && toDateKey(new Date(task.completedAt)) === key).length
        return <div key={key} className={cn("planner-month-day", key === date && "is-selected", !isSameMonth(value, day) && "outside")}>
          <button type="button" data-planner-date={key} aria-pressed={key === date} aria-label={format(value, "EEEE, MMMM d")} tabIndex={key === date ? 0 : -1} onKeyDown={(e) => onKey(e, key)} onClick={() => onDate(key)} className={cn("planner-date", key === todayKey() && "is-today")}>{format(value, "d")}</button>
          {(logged || completed > 0) && <span className="block text-[10px] text-muted-foreground">{logged ? "Log" : ""}{logged && completed > 0 ? " · " : ""}{completed > 0 ? `${completed} done` : ""}</span>}
          {items.slice(0, 3).map((task) => <CalendarItem key={task.id} task={task} date={key} selected={selected} onSelect={onSelect} />)}
          {items.length > 3 && <button className="planner-more" onClick={() => { onDate(key); setView("day") }}>+{items.length - 3} more</button>}
          <button type="button" className="planner-add-day" aria-label={`Add task on ${format(value, "MMM d")}`} onClick={() => add(key)}><Plus className="size-3" /></button>
        </div>
      })}</div>
    </div> : <div className="planner-schedule" role="group" aria-label={`${view} calendar`}>
      <div className="planner-week-head" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
        <span className="text-faint flex items-center justify-center"><CalendarDays className="size-4" /></span>
        {days.map((value) => {
          const key = toDateKey(value)
          return <button key={key} type="button" data-planner-date={key} aria-pressed={key === date} tabIndex={key === date ? 0 : -1} onKeyDown={(e) => onKey(e, key)} onClick={() => onDate(key)} className={cn("planner-week-date", key === date && "is-selected", key === todayKey() && "is-today")} aria-label={format(value, "EEEE, MMMM d")}><span>{format(value, "EEE")}</span><strong>{format(value, "d")}</strong></button>
        })}
      </div>
      <div className="planner-all-day" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
        <span className="planner-time-label">All-day<br />/ Due</span>
        {days.map((value) => {
          const key = toDateKey(value)
          const items = tasks.filter((task) => { const slot = taskSlot(task); return (slot.date === key && !slot.time) || (task.due === key && slot.date !== key) })
          return <div key={key} className="planner-all-day-cell">{items.map((task) => <CalendarItem key={task.id} task={task} date={key} selected={selected} onSelect={onSelect} />)}</div>
        })}
      </div>
      <div className="planner-time-scroll" ref={scroll}>
        <div className="planner-time-grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))`, height: 24 * HOUR }}>
          <div className="planner-hour-labels">{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: hour * HOUR }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
          {days.map((value) => <TimedDay key={toDateKey(value)} date={toDateKey(value)} tasks={tasks} selected={selected} onSelect={onSelect} onAdd={add} />)}
        </div>
      </div>
    </div>}
  </Panel>
}

function CalendarItem({ task, date, selected, onSelect }: { task: Task; date: string; selected?: string; onSelect: (task: Task) => void }) {
  const slot = taskSlot(task)
  const deadline = task.due === date && (slot.date !== date || !slot.time)
  return <button type="button" className={cn("planner-event", task.done && "is-done", selected === task.id && "is-active")} aria-pressed={selected === task.id} onClick={() => onSelect(task)} title={`${task.title}${task.due ? ` · Due ${task.due}` : ""}`}>
    {task.done && <Check className="size-3 shrink-0" />}<span>{deadline ? "Due: " : slot.time ? `${slot.time} ` : ""}{task.title}</span>
  </button>
}

function TimedDay({ date, tasks, selected, onSelect, onAdd }: { date: string; tasks: Task[]; selected?: string; onSelect: (task: Task) => void; onAdd: (date: string, time?: string) => void }) {
  const lanes = useMemo(() => timedLanes(tasks, date), [tasks, date])
  return <div className={cn("planner-timed-day", date === todayKey() && "is-today")}>
    {Array.from({ length: 24 }, (_, hour) => <button key={hour} type="button" className="planner-hour-cell" style={{ top: hour * HOUR, height: HOUR }} aria-label={`Add task ${date} at ${String(hour).padStart(2, "0")}:00`} onClick={() => onAdd(date, `${String(hour).padStart(2, "0")}:00`)} />)}
    {lanes.map(({ task, start, end, lane, lanes: count }) => <button key={task.id} type="button" aria-pressed={selected === task.id} className={cn("planner-timed-event", task.done && "is-done", selected === task.id && "is-active")} onClick={() => onSelect(task)} title={`${task.title} · ${taskSlot(task).time}`} style={{ top: start / 60 * HOUR, height: Math.max(44, (end - start) / 60 * HOUR), left: `calc(${lane / count * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)` }}>
      <span className="block break-words">{task.done && "✓ "}{task.title}</span><span className="block text-[10px]">{taskSlot(task).time}{task.durationMinutes ? ` · ${task.durationMinutes}m` : ""}</span>
    </button>)}
  </div>
}
