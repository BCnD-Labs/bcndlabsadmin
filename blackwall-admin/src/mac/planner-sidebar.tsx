import { memo } from "react"
import { CalendarDays, FileText, ListTodo, Maximize2, X } from "lucide-react"
import { CalendarTool, LogTool, TasksTool } from "./dock/tools"

const LiveCalendar = memo(CalendarTool)
const LiveTasks = memo(TasksTool)
const LiveLog = memo(LogTool)

/** The Planner's three pieces (calendar, tasks, daily log) as a panel that slides in from the right. */
export function PlannerSidebar({ overdue, onClose, onExpand }: { overdue: number; onClose: () => void; onExpand: () => void }) {
  return (
    <aside className="mac-dw-sidebar" aria-label="Planner">
      <header className="mac-dw-sidebar-head">
        <span className="mac-dw-icon" style={{ ["--dw-hue" as string]: "#64b5f6" }}><CalendarDays size={16} /></span>
        <strong>Planner</strong>
        {overdue > 0 && <span className="mac-dw-sidebar-late">{overdue} overdue</span>}
        <span className="mac-dw-spacer" />
        <button type="button" aria-label="Open full Planner" title="Open full Planner" onClick={onExpand}><Maximize2 size={15} /></button>
        <button type="button" aria-label="Close Planner" onClick={onClose}><X size={17} /></button>
      </header>
      <div className="mac-dw-sidebar-body">
        <section><h2><CalendarDays size={14} />Calendar</h2><LiveCalendar /></section>
        <section><h2><ListTodo size={14} />Tasks</h2><LiveTasks /></section>
        <section><h2><FileText size={14} />Daily log</h2><LiveLog /></section>
      </div>
    </aside>
  )
}
