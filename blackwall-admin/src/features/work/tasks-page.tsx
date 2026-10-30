import { Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState, PageHeader } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectSelect } from "@/components/forms/fields"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"
import { TaskRow } from "./task-row"
import { TASK_FILTERS, compareTasks, matchesFilter, type TaskFilter } from "./task-utils"

export function TasksPage() {
  const tasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)
  const projects = useProjectMap()
  const [filter, setFilter] = useState<TaskFilter>("all")
  const [projectId, setProjectId] = useState<string>()
  const [q, setQ] = useState("")

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return tasks
      .filter((t) => matchesFilter(t, filter))
      .filter((t) => (projectId ? t.projectId === projectId : true))
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.notes?.toLowerCase().includes(needle))
      .sort(compareTasks)
  }, [tasks, filter, projectId, q])

  return (
    <>
      <PageHeader
        title="Tasks"
        badge={<SourceBadge status="local" />}
        description={`${tasks.filter((t) => t.status !== "done").length} open · ${tasks.filter((t) => t.status === "done").length} done`}
        actions={
          <Button onClick={() => openForm({ kind: "task", defaults: { projectId } })}>
            <Plus /> New task
          </Button>
        }
      />
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as TaskFilter)} aria-label="Filter tasks" className="flex-wrap">
            {TASK_FILTERS.map((f) => (
              <ToggleGroupItem key={f.value} value={f.value} className="px-2 text-xs data-[state=on]:text-amber">
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by text" aria-label="Filter tasks by text" className="h-7 w-44 pl-7 text-xs" />
            </div>
            <ProjectSelect allowAll value={projectId} onChange={setProjectId} className="h-7 w-44 text-xs" />
          </div>
        </div>
        {visible.length ? (
          <ul aria-label="Tasks">
            {visible.map((t) => (
              <TaskRow key={t.id} task={t} project={t.projectId ? projects.get(t.projectId) : undefined} />
            ))}
          </ul>
        ) : (
          <EmptyState>No tasks match.</EmptyState>
        )}
      </div>
    </>
  )
}
