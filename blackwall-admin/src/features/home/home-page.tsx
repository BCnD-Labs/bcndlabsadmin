import { format } from "date-fns"
import { todayKey } from "@/lib/dates"
import { useWorkspace } from "@/stores/workspace"
import { needsAttention, isOverdue } from "@/features/work/task-utils"
import { AgendaPanel } from "./agenda-panel"
import { DevAttention } from "./dev-attention"
import { PinnedNotes } from "./pinned-notes"
import { RecentItems } from "./recent-items"
import { TasksPanel } from "./tasks-panel"
import { TrafficPanel } from "./traffic-panel"

/** One-line status derived from local records — a sentence, not KPI tiles. */
function StatusLine() {
  const tasks = useWorkspace((s) => s.tasks)
  const events = useWorkspace((s) => s.events)
  const drafts = useWorkspace((s) => s.drafts)
  const attention = tasks.filter(needsAttention).length
  const overdue = tasks.filter(isOverdue).length
  const today = events.filter((e) => e.date === todayKey()).length
  const inReview = drafts.filter((d) => d.status === "review").length

  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 className="text-lg font-bold">{format(new Date(), "EEEE, MMMM d")}</h1>
      <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground" data-testid="status-line">
        <span><b className="font-mono text-foreground">{attention}</b> need attention</span>
        {overdue > 0 && <span className="text-red-text"><b className="font-mono">{overdue}</b> overdue</span>}
        <span><b className="font-mono text-foreground">{today}</b> {today === 1 ? "event" : "events"} today</span>
        <span><b className="font-mono text-foreground">{inReview}</b> {inReview === 1 ? "draft" : "drafts"} in review</span>
      </p>
    </div>
  )
}

export function HomePage() {
  return (
    <>
      <StatusLine />
      {/* md: 2 columns with notes moved beside agenda; lg+: 12-col rows per the layout brief */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12">
        <TasksPanel className="md:order-1 md:col-span-2 lg:order-none lg:col-span-7 xl:col-span-8" />
        <AgendaPanel className="md:order-2 lg:order-none lg:col-span-5 xl:col-span-4" />
        <TrafficPanel className="md:order-4 md:col-span-2 lg:order-none lg:col-span-7 xl:col-span-8" />
        <PinnedNotes className="md:order-3 lg:order-none lg:col-span-5 xl:col-span-4" />
        <DevAttention className="md:order-5 lg:order-none lg:col-span-7 xl:col-span-7" />
        <RecentItems className="md:order-6 lg:order-none lg:col-span-5 xl:col-span-5" />
      </div>
    </>
  )
}
