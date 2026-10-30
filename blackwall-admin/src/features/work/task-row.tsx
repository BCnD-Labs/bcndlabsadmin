import { CalendarClock, Star } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { relativeDue } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { isOverdue } from "./task-utils"

export function TaskRow({ task, onToggle, showDetails }: { task: Task; onToggle?: (task: Task) => void; showDetails?: boolean }) {
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const toggleStar = useWorkspace((s) => s.toggleStar)
  const openForm = useUi((s) => s.openForm)
  const overdue = isOverdue(task)

  return (
    <li className="group flex min-h-10 items-center gap-2.5 border-b border-border/60 px-3 py-1.5 last:border-b-0 hover:bg-muted/40" data-testid="task-row">
      <Checkbox
        checked={task.done}
        onCheckedChange={() => {
          toggleTask(task.id)
          onToggle?.(task)
        }}
        aria-label={task.done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        className="size-5 rounded-full"
      />
      <button
        type="button"
        onClick={() => openForm({ kind: "task", id: task.id })}
        className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Edit task"
      >
        <span className={cn("block truncate text-sm hover:underline", task.done && "text-muted-foreground line-through")}>{task.title}</span>
        {showDetails && task.details && <span className="block truncate text-xs text-muted-foreground">{task.details}</span>}
      </button>
      {task.done && task.completedAt ? (
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums" title={task.due ? `Was due ${task.due}` : undefined}>
          Done {format(new Date(task.completedAt), "EEE MMM d")}
        </span>
      ) : task.due && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-end gap-1 font-mono text-xs tabular-nums",
            overdue ? "text-red-text" : "text-muted-foreground",
          )}
        >
          {overdue && <CalendarClock className="size-3" aria-hidden />}
          {relativeDue(task.due)}
        </span>
      )}
      <button
        type="button"
        onClick={() => toggleStar(task.id)}
        aria-pressed={task.starred}
        aria-label={task.starred ? `Unstar "${task.title}"` : `Star "${task.title}"`}
        className={cn(
          "shrink-0 rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          task.starred ? "text-amber" : "text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Star className={cn("size-4", task.starred && "fill-current")} />
      </button>
    </li>
  )
}
