import { ListChecks, Plus } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectSelect } from "@/components/forms/fields"
import { todayKey } from "@/lib/dates"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"
import { TaskRow } from "@/features/work/task-row"
import { TASK_FILTERS, compareTasks, matchesFilter, needsAttention, type TaskFilter } from "@/features/work/task-utils"

export function TasksPanel({ className }: { className?: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const create = useWorkspace((s) => s.create)
  const openForm = useUi((s) => s.openForm)
  const projects = useProjectMap()
  const [filter, setFilter] = useState<TaskFilter>("attention")
  const [projectId, setProjectId] = useState<string | undefined>()
  const [quick, setQuick] = useState("")
  // Tasks completed here stay visible (struck through) until the filter changes.
  const [lingering, setLingering] = useState<Set<string>>(new Set())

  const visible = useMemo(
    () =>
      tasks
        .filter((t) => (projectId ? t.projectId === projectId : true))
        .filter((t) => matchesFilter(t, filter) || lingering.has(t.id))
        .sort(compareTasks),
    [tasks, filter, projectId, lingering],
  )

  // With the attention filter, fill spare room with the next open tasks.
  const nextUp = useMemo(
    () =>
      filter !== "attention"
        ? []
        : tasks
            .filter((t) => (projectId ? t.projectId === projectId : true))
            .filter((t) => t.status !== "done" && !needsAttention(t) && !lingering.has(t.id))
            .sort(compareTasks)
            .slice(0, 5),
    [tasks, filter, projectId, lingering],
  )

  const counts = useMemo(() => {
    const scoped = tasks.filter((t) => (projectId ? t.projectId === projectId : true))
    return Object.fromEntries(
      TASK_FILTERS.map((f) => [f.value, scoped.filter((t) => matchesFilter(t, f.value)).length]),
    ) as Record<TaskFilter, number>
  }, [tasks, projectId])

  const changeFilter = (f: TaskFilter) => {
    setFilter(f)
    setLingering(new Set())
  }

  const quickAdd = (e: FormEvent) => {
    e.preventDefault()
    const title = quick.trim()
    if (!title) return
    create("tasks", {
      title,
      status: "todo",
      priority: "medium",
      due: filter === "upcoming" ? undefined : todayKey(),
      projectId,
    })
    setQuick("")
    toast.success("Task added", { description: filter === "upcoming" ? "No due date" : "Due today" })
  }

  return (
    <Panel
      id="tasks"
      title="Today · needs attention"
      icon={<ListChecks />}
      badge={<SourceBadge status="local" />}
      className={className}
      bodyClassName="flex flex-col"
      actions={
        <>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/work/tasks">All tasks</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => openForm({ kind: "task", defaults: { projectId } })}>
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
          onValueChange={(v) => v && changeFilter(v as TaskFilter)}
          aria-label="Filter tasks"
          className="flex-wrap"
        >
          {TASK_FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="gap-1.5 px-2 text-xs data-[state=on]:text-amber">
              {f.label}
              <span className="font-mono text-[0.68rem] text-muted-foreground tabular-nums">{counts[f.value]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ProjectSelect allowAll value={projectId} onChange={setProjectId} className="ml-auto h-7 w-40 text-xs" />
      </div>

      <form onSubmit={quickAdd} className="flex items-center gap-2 border-b px-3 py-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder={filter === "upcoming" ? "Add a task without a due date…" : "Add a task due today… (Enter)"}
          aria-label="Quick add task"
          className="h-7 border-transparent bg-transparent px-1 shadow-none focus-visible:border-input dark:bg-transparent"
        />
      </form>

      <div className="max-h-[26rem] min-h-0 flex-1 overflow-y-auto lg:max-h-none lg:basis-0">
        {visible.length ? (
          <ul aria-label="Tasks">
            {visible.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={t.projectId ? projects.get(t.projectId) : undefined}
                onToggle={(task) =>
                  task.status !== "done" && setLingering((s) => new Set(s).add(task.id))
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState className="py-6">
            {filter === "attention" ? "Nothing needs attention. Clear runway." : "No tasks match this filter."}
          </EmptyState>
        )}
        {nextUp.length > 0 && (
          <>
            <h3 className="eyebrow border-y bg-recessed/40 px-3 py-1.5">Next up</h3>
            <ul aria-label="Next up">
              {nextUp.map((t) => (
                <TaskRow key={t.id} task={t} project={t.projectId ? projects.get(t.projectId) : undefined} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  )
}
