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
    <li className="group flex min-h-10 items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0 hover:bg-raised" data-testid="task-row">
      <Checkbox
        checked={task.done}
        onCheckedChange={() => {
          toggleTask(task.id)
          onToggle?.(task)
        }}
        aria-label={task.done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
      />
      <button
        type="button"
        onClick={() => openForm({ kind: "task", id: task.id })}
        className="min-w-0 flex-1 rounded-[4px] py-0.5 text-left"
        title="Edit task"
      >
        <span className={cn("block truncate text-[13px] text-ink", task.done && "text-faint line-through")}>{task.title}</span>
        {showDetails && task.details && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{task.details}</span>}
      </button>
      {task.done && task.completedAt ? (
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums" title={task.due ? `Was due ${task.due}` : undefined}>
          Done {format(new Date(task.completedAt), "EEE MMM d")}
        </span>
      ) : task.due && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-end gap-1 text-[11px] tabular-nums",
            overdue ? "text-amber" : "text-muted-foreground",
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
          "flex size-7 shrink-0 items-center justify-center rounded-[6px] hover:bg-selected",
          task.starred ? "text-amber" : "text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        <Star className={cn("size-3.5", task.starred && "fill-current")} />
      </button>
    </li>
  )
}
