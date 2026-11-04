import { useState } from "react"
import { addDays, addMonths, format, isToday, startOfMonth } from "date-fns"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PlannerCalendar } from "@/features/productivity/planner-calendar"
import { PlannerNotes } from "@/features/productivity/planner-notes"
import { parseKey, toDateKey, todayKey } from "@/lib/dates"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { useDock, type ToolId } from "./dock-store"

/** The Planner, split into pieces that live beside any page. They all follow the dock's chosen day. */

function DayNav({ label }: { label: string }) {
  const date = useDock((s) => s.date)
  const setDate = useDock((s) => s.setDate)
  const day = parseKey(date)
  return (
    <div className="mac-tool-row">
      <strong>{label}</strong>
      <span className="mac-tool-spacer" />
      <Button variant="quiet" size="icon-sm" aria-label="Previous day" onClick={() => setDate(toDateKey(addDays(day, -1)))}><ChevronLeft /></Button>
      <Button variant="outline" size="xs" disabled={isToday(day)} onClick={() => setDate(todayKey())}>Today</Button>
      <Button variant="quiet" size="icon-sm" aria-label="Next day" onClick={() => setDate(toDateKey(addDays(day, 1)))}><ChevronRight /></Button>
    </div>
  )
}

export function CalendarTool() {
  const date = useDock((s) => s.date)
  const setDate = useDock((s) => s.setDate)
  const [month, setMonth] = useState(() => startOfMonth(parseKey(date)))
  const pick = (value: string) => {
    setDate(value)
    setMonth(startOfMonth(parseKey(value)))
  }
  return (
    <div>
      <div className="mac-tool-row">
        <strong>{format(month, "MMMM yyyy")}</strong>
        <span className="mac-tool-spacer" />
        <Button variant="quiet" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></Button>
        <Button variant="outline" size="xs" onClick={() => pick(todayKey())}>Today</Button>
        <Button variant="quiet" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button>
      </div>
      <PlannerCalendar selected={date} month={month} onSelect={pick} />
    </div>
  )
}

export function TasksTool() {
  const date = useDock((s) => s.date)
  const tasks = useWorkspace((s) => s.tasks)
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()
  const today = todayKey()
  const day = tasks.filter((t) => t.due === date || t.focusDate === date)
  const overdue = date === today ? tasks.filter((t) => !t.done && t.due && t.due < today && t.focusDate !== date) : []
  const rows = [...overdue.map((t) => ({ t, late: true })), ...day.map((t) => ({ t, late: false }))]
  const open = (id: string) => navigate(`/productivity?date=${date}&task=${id}`)
  return (
    <div>
      <div className="mac-tool-row">
        <strong>{isToday(parseKey(date)) ? "Today" : format(parseKey(date), "EEE, MMM d")}</strong>
        <span className="mac-tool-count">{rows.filter((r) => !r.t.done).length} open</span>
        <span className="mac-tool-spacer" />
        <Button variant="outline" size="xs" onClick={() => openForm({ kind: "task", defaults: { due: date } })}><Plus /> Task</Button>
      </div>
      {rows.length ? (
        <ul className="mac-task-list">
          {rows.map(({ t, late }) => (
            <li key={t.id} className="mac-task" data-done={t.done} data-late={late}>
              <Checkbox checked={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onCheckedChange={() => toggleTask(t.id)} />
              <button type="button" onClick={() => open(t.id)}>{t.title}</button>
              {late && <span className="mac-task-tag">overdue</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mac-tool-empty">Nothing due or focused on this day.</p>
      )}
    </div>
  )
}

export function LogTool() {
  const date = useDock((s) => s.date)
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === date))
  const saveJournal = useWorkspace((s) => s.saveJournal)
  return (
    <div>
      <DayNav label={format(parseKey(date), "EEE, MMM d")} />
      <label htmlFor="dock-log" className="sr-only">Daily log for {date}</label>
      <textarea id="dock-log" className="mac-log" value={entry?.text ?? ""} onChange={(e) => saveJournal(date, e.target.value)} placeholder="What happened? A few lines are enough." />
    </div>
  )
}

export function NotesTool() {
  return <div className="mac-notes-tool"><PlannerNotes /></div>
}

export const TOOL_VIEWS: Record<ToolId, () => React.JSX.Element> = { calendar: CalendarTool, today: TasksTool, log: LogTool, notes: NotesTool }
