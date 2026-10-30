import { ListChecks, Plus } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState, Panel } from "@/components/common/panel"
import { daysUntil, relativeDue, todayKey } from "@/lib/dates"
import { parseQuickAdd } from "@/lib/quick-add"
import type { Task } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { TaskRow } from "@/features/work/task-row"
import { TASK_FILTERS, compareTasks, matchesFilter, type TaskFilter } from "@/features/work/task-utils"

const EMPTY: Record<TaskFilter, string> = {
  today: "Nothing due today. Starred tasks also show here.",
  upcoming: "Nothing else coming up.",
  all: "No open tasks.",
  done: "Nothing completed yet.",
}

/** "Today" splits into what's due and what you starred, so the counts read clearly. */
function sections(filter: TaskFilter, items: Task[]): { name?: string; items: Task[] }[] {
  if (filter !== "today") return [{ items }]
  const due = items.filter((t) => t.due && daysUntil(t.due) <= 0)
  const starred = items.filter((t) => !due.includes(t))
  return [
    { name: "Overdue & due today", items: due },
    { name: "Starred", items: starred },
  ].filter((s) => s.items.length)
}

export function TasksPanel({ className }: { className?: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const create = useWorkspace((s) => s.create)
  const openForm = useUi((s) => s.openForm)
  const [filter, setFilter] = useState<TaskFilter>("today")
  const [quick, setQuick] = useState("")
  // Tasks checked off here stay visible (struck through) until the filter changes.
  const [lingering, setLingering] = useState<Set<string>>(new Set())

  const visible = useMemo(
    () => tasks.filter((t) => matchesFilter(t, filter) || lingering.has(t.id)).sort(compareTasks),
    [tasks, filter, lingering],
  )
  const counts = useMemo(
    () => Object.fromEntries(TASK_FILTERS.map((f) => [f.value, tasks.filter((t) => matchesFilter(t, f.value)).length])) as Record<TaskFilter, number>,
    [tasks],
  )

  const quickAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!quick.trim()) return
    const parsed = parseQuickAdd(quick)
    const due = parsed.due ?? (filter === "today" ? todayKey() : undefined)
    create("tasks", { title: parsed.title, due, starred: false, done: false })
    setQuick("")
    toast.success("Task added", { description: due ? `Due ${relativeDue(due).toLowerCase()}` : "No due date" })
  }

  return (
    <Panel
      id="tasks"
      title="Tasks"
      icon={<ListChecks />}
      accent="amber"
      className={className}
      bodyClassName="flex flex-col"
      actions={
        <>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/work/tasks">All tasks</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => openForm({ kind: "task", defaults: filter === "today" ? { due: todayKey() } : {} })}>
            <Plus /> Task
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={filter}
          onValueChange={(v) => {
            if (!v) return
            setFilter(v as TaskFilter)
            setLingering(new Set())
          }}
          aria-label="Filter tasks"
          className="flex-wrap"
        >
          {TASK_FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="gap-1.5 px-2 text-xs">
              {f.label}
              <span className="font-mono text-[0.68rem] tabular-nums opacity-70">{counts[f.value]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <form onSubmit={quickAdd} className="flex items-center gap-2 border-b px-3 py-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder={filter === "today" ? "Add a task for today, or end with tomorrow / fri…" : "Add a task, end with today / tomorrow / fri to set a date"}
          aria-label="Quick add task"
          className="h-7 border-transparent bg-transparent px-1 shadow-none focus-visible:border-input dark:bg-transparent"
        />
      </form>

      <div className="max-h-[26rem] min-h-0 flex-1 overflow-y-auto lg:max-h-none lg:basis-0">
        {visible.length ? (
          sections(filter, visible).map((sec) => (
            <section key={sec.name} aria-label={sec.name ?? "Tasks"}>
              {sec.name && <h3 className="eyebrow border-b bg-recessed/40 px-3 py-1">{sec.name} · {sec.items.length}</h3>}
              <ul>
                {sec.items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    showDetails
                    onToggle={(task) => !task.done && setLingering((s) => new Set(s).add(task.id))}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <EmptyState className="py-6">{tasks.length === 0 ? "No tasks yet. Type one above and press Enter." : EMPTY[filter]}</EmptyState>
        )}
      </div>
    </Panel>
  )
}
