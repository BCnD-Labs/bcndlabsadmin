import { useMemo, useState } from "react"
import { format, isToday } from "date-fns"
import { ListChecks, Plus, Search, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ListGroupLabel } from "@/components/common/list"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { TaskRow } from "@/features/work/task-row"
import { GROUP_ORDER, compareTasks, groupOf, type TaskGroup } from "@/features/work/task-utils"
import { daysUntil, parseKey } from "@/lib/dates"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { reflectionSummary } from "./planner-utils"
function SearchBox({ value, onChange, label, onClose }: { value: string; onChange: (v: string) => void; label: string; onClose: () => void }) {
  return <div className="flex gap-2 px-3 py-2"><input className="planner-search flex-1" aria-label={label} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} /><Button variant="quiet" size="xs" onClick={onClose}>Close</Button></div>
}
type TaskTab = "today" | "next" | "all" | "done"

const inTab = (t: Task, tab: TaskTab) => {
  if (tab === "done") return t.done
  if (t.done) return false
  if (tab === "today") return !!t.due && daysUntil(t.due) <= 0
  if (tab === "next") return !!t.due && daysUntil(t.due) > 0
  return true
}

const TAB_GROUPS: Record<Exclude<TaskTab, "done">, TaskGroup[]> = {
  today: ["Overdue", "Today"],
  next: ["Tomorrow", "Next 7 days", "Later"],
  all: GROUP_ORDER,
}

/** Tasks under the calendar. Add opens the task form, due on the day selected in the calendar. */
export function TaskBrowser({ date, onSelect, onComplete }: { date: string; onSelect: (task: Task) => void; onComplete: (task: Task) => void }) {
  const tasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)
  const [tab, setTab] = useState<TaskTab>("today")
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)
  const [starred, setStarred] = useState(false)
  // Checked off here: stays visible (struck through) until the tab changes.
  const [lingering, setLingering] = useState<Set<string>>(new Set())

  const needle = q.trim().toLowerCase()
  const rows = useMemo(
    () =>
      tasks
        .filter((t) => (inTab(t, tab) || lingering.has(t.id)) && (!needle || t.title.toLowerCase().includes(needle) || !!t.details?.toLowerCase().includes(needle) || reflectionSummary(t).toLowerCase().includes(needle)) && (!starred || t.starred))
        .sort(compareTasks),
    [tasks, tab, lingering, needle, starred],
  )
  const count = (k: TaskTab) => tasks.filter((t) => inTab(t, k)).length
  const changeTab = (t: TaskTab) => {
    setTab(t)
    setLingering(new Set())
  }
  const closeSearch = () => {
    setQ("")
    setSearching(false)
  }
  const groups =
    tab === "done"
      ? [{ name: null as TaskGroup | null, items: rows }]
      : TAB_GROUPS[tab].map((g) => ({ name: g as TaskGroup | null, items: rows.filter((t) => groupOf(t) === g || (t.done && lingering.has(t.id) && g === TAB_GROUPS[tab][0])) })).filter((g) => g.items.length)
  const dueLabel = isToday(parseKey(date)) ? "today" : format(parseKey(date), "MMM d")
  const add = () => openForm({ kind: "task", defaults: { due: date } })

  return (
    <Panel
      id="task-browser"
      category="tasks"
      title="Tasks"
      tool="tasks"
      command={tab}
      className="min-h-0 flex-1 scroll-mt-28"
      bodyClassName="flex min-h-0 flex-col"
      actions={
        <>
          <Button variant="quiet" size="icon-sm" aria-label="Search tasks" aria-pressed={searching} onClick={() => (searching ? closeSearch() : setSearching(true))}>
            <Search />
          </Button>
          <Button variant="quiet" size="icon-sm" aria-label="Starred only" aria-pressed={starred} onClick={() => setStarred(!starred)}>
            <Star className={cn(starred && "fill-current text-amber")} />
          </Button>
          <Button variant="quiet" size="icon-sm" aria-label={`New task, due ${dueLabel}`} title={`New task, due ${dueLabel}`} onClick={add}>
            <Plus />
          </Button>
        </>
      }
    >
      <div className="shrink-0 px-2.5 pt-2.5 pb-1.5">
        <SegmentedTabs
          label="Task views"
          idBase="planner-tasks"
          value={tab}
          onChange={changeTab}
          tabClassName="px-1 text-[11px]"
          tabs={[
            { value: "today", label: "Today", count: count("today") },
            { value: "next", label: "Next", count: count("next") },
            { value: "all", label: "All", count: count("all") },
            { value: "done", label: "Done" },
          ]}
        />
      </div>
      {searching && <SearchBox value={q} onChange={setQ} label="Search tasks" onClose={closeSearch} />}
      <div id="planner-tasks-panel" role="tabpanel" aria-labelledby={`planner-tasks-tab-${tab}`} className={cn("max-h-80 min-h-0 flex-1 overflow-y-auto", searching && "mt-2")}>
        {rows.length ? (
          groups.map((g) => (
            <section key={g.name ?? "done"} aria-label={g.name ?? "Completed"}>
              {g.name && (tab !== "today" || groups.length > 1) && (
                <ListGroupLabel tone={g.name === "Overdue" ? "warn" : undefined} className="px-3 py-1">
                  {g.name} <span className="text-faint">· {g.items.length}</span>
                </ListGroupLabel>
              )}
              <ul>
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} dense wrap hideCourse onSelect={onSelect} onToggle={(x) => { if (!x.done) { setLingering((s) => new Set(s).add(x.id)); onComplete(x) } }} />
                ))}
              </ul>
            </section>
          ))
        ) : needle || starred ? (
          <EmptyState title="No tasks match" action={<Button variant="outline" size="sm" onClick={() => (closeSearch(), setStarred(false))}>Clear filters</Button>} />
        ) : (
          <EmptyState
            icon={ListChecks}
            title={{ today: "Nothing due today", next: "Nothing scheduled", all: "No open tasks", done: "Nothing completed yet" }[tab]}
            action={tab !== "done" && <Button variant="outline" size="sm" onClick={add}><Plus /> Add a task</Button>}
          />
        )}
      </div>
    </Panel>
  )
}

