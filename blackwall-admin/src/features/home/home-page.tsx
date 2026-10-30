import { format } from "date-fns"
import { Link } from "react-router-dom"
import { todayKey } from "@/lib/dates"
import { useWorkspace } from "@/stores/workspace"
import { isOverdue } from "@/features/work/task-utils"
import { logHref } from "@/features/journal/daily-log-page"
import { ActivityPanel } from "./activity-panel"
import { CalendarPanel } from "./calendar-panel"
import { DevAttention } from "./dev-attention"
import { PinnedNotes } from "./pinned-notes"
import { TasksPanel } from "./tasks-panel"
import { TrafficPanel } from "./traffic-panel"

function StatusLine() {
  const tasks = useWorkspace((s) => s.tasks)
  const logged = useWorkspace((s) => s.journal.some((j) => j.id === todayKey()))
  const dueToday = tasks.filter((t) => !t.done && t.due === todayKey()).length
  const overdue = tasks.filter(isOverdue).length
  const starred = tasks.filter((t) => !t.done && t.starred).length

  const chips: { label: string; value: string | number; tone: string; to?: string }[] = [
    { label: "Due today", value: dueToday, tone: "text-amber" },
    { label: "Overdue", value: overdue, tone: overdue ? "text-red" : "text-muted-foreground" },
    { label: "Starred", value: starred, tone: "text-magenta" },
    { label: "Today's log", value: logged ? "✓" : "—", tone: logged ? "text-teal" : "text-muted-foreground", to: logHref(todayKey()) },
  ]

  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <p className="eyebrow">{format(new Date(), "EEEE")}</p>
        <h1 className="font-heading text-3xl leading-none font-bold tracking-tight">{format(new Date(), "MMMM d")}</h1>
      </div>
      <ul className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto sm:flex-wrap" data-testid="status-line">
        {chips.map((c) => {
          const inner = (
            <>
              <span className={`pixel-num text-3xl ${c.tone}`}>{c.value}</span>
              <span className="eyebrow text-[0.6rem] sm:text-[0.7rem]">{c.label}</span>
            </>
          )
          return (
            <li key={c.label}>
              {c.to ? (
                <Link to={c.to} className="brutal flex h-full flex-col items-start gap-1 rounded-lg bg-card px-2.5 py-1.5 hover:border-teal sm:flex-row sm:items-end sm:gap-2 sm:px-3">
                  {inner}
                </Link>
              ) : (
                <span className="brutal flex h-full flex-col items-start gap-1 rounded-lg bg-card px-2.5 py-1.5 sm:flex-row sm:items-end sm:gap-2 sm:px-3">{inner}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function HomePage() {
  return (
    <>
      <StatusLine />
      {/* md: 2 columns with notes beside the calendar; lg+: three 12-column rows */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12">
        <TasksPanel className="md:order-1 md:col-span-2 lg:order-none lg:col-span-7 xl:col-span-8" />
        <CalendarPanel className="md:order-2 lg:order-none lg:col-span-5 xl:col-span-4" />
        <TrafficPanel className="md:order-4 md:col-span-2 lg:order-none lg:col-span-7 xl:col-span-8" />
        <PinnedNotes className="md:order-3 lg:order-none lg:col-span-5 xl:col-span-4" />
        <DevAttention className="md:order-5 lg:order-none lg:col-span-7 xl:col-span-7" />
        <ActivityPanel className="md:order-6 lg:order-none lg:col-span-5 xl:col-span-5" />
      </div>
    </>
  )
}
