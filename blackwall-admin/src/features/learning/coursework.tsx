import { DocLinksMenu } from "@/components/common/doc-links"
import { CalendarClock } from "lucide-react"
import { Link } from "react-router-dom"
import { Checkbox } from "@/components/ui/checkbox"
import { daysUntil, formatTime, relativeDue } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import type { Course, LearningKind, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { courseColor, courseLabel, kindInfo, learningType } from "./learning-utils"
import { stepProgress } from "@shared/steps"
import { StatusPill, tracksStatus } from "./status-pill"

/** The kind's icon tile in its own hue (Course blue, Certification green, …). */
export function KindIcon({ kind, className, small }: { kind?: LearningKind; className?: string; small?: boolean }) {
  const info = kindInfo(kind)
  return (
    <span data-category={`kind-${info.value}`} className={cn("bw-category-icon inline-flex shrink-0 items-center justify-center", small ? "size-6 rounded-[6px]" : "size-7 rounded-md", className)} aria-hidden>
      <info.icon className={small ? "size-3.5" : "size-4"} strokeWidth={1.8} />
    </span>
  )
}

/** The course chip: a coloured square and the course code. Links to the course unless `static`. */
export function CourseTag({ course, className, asLink = true }: { course?: Course; className?: string; asLink?: boolean }) {
  if (!course) return null
  const cls = cn(
    "inline-flex h-5 max-w-full shrink-0 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[11px] font-medium whitespace-nowrap text-ink-2",
    asLink && "hover:bg-ink-2/15 hover:text-ink",
    className,
  )
  const body = (
    <>
      <span className={cn("size-1.5 shrink-0 rounded-[1.5px]", courseColor(course.color).dot)} aria-hidden />
      <span className="truncate">{courseLabel(course)}</span>
    </>
  )
  return asLink ? (
    <Link to={courseHref(course.id)} className={cls} title={course.title} onClick={(e) => e.stopPropagation()}>
      {body}
    </Link>
  ) : (
    <span className={cls} title={course.title}>
      {body}
    </span>
  )
}

/** When a piece of coursework is: "Today · 11:59 PM", "3d overdue", "Mar 4". */
export function courseworkWhen(t: Task) {
  if (!t.due) return "No date"
  const rel = relativeDue(t.due)
  return t.time ? `${rel} · ${formatTime(t.time)}` : rel
}

/**
 * One assignment / exam / milestone / event: checkbox, type icon, title, optional
 * course chip, and when it's due. Clicking the title opens the task form.
 */
export function CourseworkRow({ task, course, showCourse }: { task: Task; course?: Course; showCourse?: boolean }) {
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const openForm = useUi((s) => s.openForm)
  const type = learningType(task.learningType, course?.kind)
  const Icon = type.icon
  const overdue = !task.done && !!task.due && daysUntil(task.due) < 0
  const soon = !task.done && !!task.due && daysUntil(task.due) >= 0 && daysUntil(task.due) <= 2

  return (
    <li className="group flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0 hover:bg-raised" data-testid="coursework-row">
      <Checkbox
        checked={task.done}
        onCheckedChange={() => toggleTask(task.id)}
        aria-label={task.done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
      />
      <span
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-[7px]", task.done ? "text-faint" : "text-ink-2")}
        title={type.label}
      >
        <Icon className="size-3.5" aria-hidden />
        <span className="sr-only">{type.label}</span>
      </span>
      <button type="button" onClick={() => openForm({ kind: "task", id: task.id })} className="min-w-0 flex-1 rounded-[4px] py-0.5 text-left" title={`Edit ${type.label.toLowerCase()}`}>
        <span className={cn("line-clamp-2 text-[13px] leading-snug break-words text-ink", task.done && "text-faint line-through")} title={task.title}>{task.title}</span>
        {showCourse && course ? (
          // Across courses, the course goes under the title so narrow columns keep the title readable.
          <span className="mt-1 flex min-w-0 items-center gap-1.5">
            <CourseTag course={course} asLink={false} className="h-[18px] text-[10px]" />
            {task.details && <span className="truncate text-[11px] text-muted-foreground">{task.details}</span>}
          </span>
        ) : (
          task.details && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{task.details}</span>
        )}
      </button>
      <DocLinksMenu links={task.links} />
      {(task.subtasks?.length ?? 0) > 0 && <span className="shrink-0 rounded-full bg-ink-2/8 px-1.5 text-[10px] tabular-nums text-ink-2" title="Steps done" data-testid="step-progress">{stepProgress(task).done}/{stepProgress(task).total}</span>}
      {tracksStatus(task, course) && <StatusPill task={task} />}
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-end gap-1 text-[11px] tabular-nums",
          overdue ? "text-amber" : soon ? "text-ink" : "text-muted-foreground",
        )}
      >
        {overdue && <CalendarClock className="size-3" aria-hidden />}
        {task.done ? "Done" : courseworkWhen(task)}
      </span>
    </li>
  )
}
