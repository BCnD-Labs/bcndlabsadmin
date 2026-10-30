import { CalendarClock } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { PriorityTag, ProjectTag } from "@/components/common/tags"
import { relativeDue } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Project, Task } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { isOverdue } from "./task-utils"

export function TaskRow({
  task,
  project,
  onToggle,
  showProject = true,
}: {
  task: Task
  project?: Project
  onToggle?: (task: Task) => void
  showProject?: boolean
}) {
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const openForm = useUi((s) => s.openForm)
  const done = task.status === "done"
  const overdue = isOverdue(task)

  return (
    <li
      className="group flex min-h-10 items-center gap-2.5 border-b border-border/60 px-3 py-1.5 last:border-b-0 hover:bg-muted/40"
      data-testid="task-row"
    >
      <Checkbox
        checked={done}
        onCheckedChange={() => {
          toggleTask(task.id)
          onToggle?.(task)
        }}
        aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        className="size-4.5"
      />
      <button
        type="button"
        onClick={() => openForm({ kind: "task", id: task.id })}
        className={cn(
          "min-w-0 flex-1 truncate rounded-sm text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
          done && "text-muted-foreground line-through",
        )}
        title="Edit task"
      >
        {task.status === "in-progress" && !done && (
          <span className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-teal align-middle" title="In progress" />
        )}
        {task.title}
      </button>
      <div className="flex shrink-0 items-center gap-2.5">
        {showProject && <ProjectTag project={project} className="hidden sm:inline-flex" />}
        <PriorityTag priority={task.priority} compact />
        {task.due ? (
          <span
            className={cn(
              "inline-flex w-[5.5rem] items-center justify-end gap-1 font-mono text-xs tabular-nums",
              overdue ? "text-red-text" : "text-muted-foreground",
            )}
          >
            {overdue && <CalendarClock className="size-3" aria-hidden />}
            {relativeDue(task.due)}
          </span>
        ) : (
          <span className="w-[5.5rem] text-right font-mono text-xs text-muted-foreground/70">—</span>
        )}
      </div>
    </li>
  )
}
