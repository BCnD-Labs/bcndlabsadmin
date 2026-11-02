import { CalendarClock, Star } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { formatTime, relativeDue } from "@/lib/dates"
import { CourseTag } from "@/features/learning/coursework"
import { learningType } from "@/features/learning/learning-utils"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { isOverdue } from "./task-utils"

export function TaskRow({
  task,
  onToggle,
  showDetails,
  dense,
  hideDate,
  hideCourse,
  wrap,
}: {
  /** Let long titles wrap onto a second line instead of truncating (Planner's Tasks card). */
  wrap?: boolean
  task: Task
  onToggle?: (task: Task) => void
  showDetails?: boolean
  /** 34px rows for side-by-side cards (Planner). */
  dense?: boolean
  /** Lists already grouped by day show only the time. */
  hideDate?: boolean
  /** Narrow columns: no course chip (the type icon still shows it's coursework). */
  hideCourse?: boolean
}) {
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const toggleStar = useWorkspace((s) => s.toggleStar)
  const openForm = useUi((s) => s.openForm)
  const course = useWorkspace((s) => (task.courseId ? s.courses.find((c) => c.id === task.courseId) : undefined))
  const overdue = isOverdue(task)
  const TypeIcon = course ? learningType(task.learningType).icon : null

  return (
    <li
      className={cn(
        "group flex items-center gap-2.5 border-b border-line-soft last:border-b-0 hover:bg-raised",
        dense ? "min-h-[34px] px-3 py-1" : "min-h-10 px-3.5 py-1.5",
      )}
      data-testid="task-row"
    >
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
        title={course ? `Edit ${learningType(task.learningType).label.toLowerCase()}` : "Edit task"}
      >
        <span className={cn("flex min-w-0 items-center gap-1.5 text-ink", wrap ? "text-sm" : "text-[13px]", task.done && "text-faint line-through")}>
          {TypeIcon && <TypeIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label={learningType(task.learningType).label} />}
          <span className={wrap ? "line-clamp-2" : "truncate"}>{task.title}</span>
        </span>
        {showDetails && task.details && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{task.details}</span>}
      </button>
      {course && !hideDate && !hideCourse && <CourseTag course={course} className="hidden sm:inline-flex" />}
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
          {hideDate ? (task.time ? formatTime(task.time) : null) : relativeDue(task.due)}
          {!hideDate && task.time && <span className="text-faint">· {formatTime(task.time)}</span>}
        </span>
      )}
      <button
        type="button"
        onClick={() => toggleStar(task.id)}
        aria-pressed={task.starred}
        aria-label={task.starred ? `Unstar "${task.title}"` : `Star "${task.title}"`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[6px] hover:bg-selected",
          dense ? "size-6" : "size-7",
          task.starred ? "text-amber" : "text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        <Star className={cn("size-3.5", task.starred && "fill-current")} />
      </button>
    </li>
  )
}
