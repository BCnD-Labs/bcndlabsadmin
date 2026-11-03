import { DocLinksMenu } from "@/components/common/doc-links"
import { CalendarClock } from "lucide-react"
import { Link } from "react-router-dom"
import { Checkbox } from "@/components/ui/checkbox"
import { daysUntil, formatTime, relativeDue } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import type { Course, LearningItemType, LearningKind, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { courseColor, courseLabel, kindInfo, learningType } from "./learning-utils"

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
 * An item's type: its icon and its kind's name for it ("Chapter", "Practice test"), on the type's
 * tint. Never color alone. In rows under ~380px wide only the icon shows; the label stays as the
 * accessible name and the tooltip. Events are neutral: they don't count toward progress.
 */
export function TypeChip({ type, kind, className }: { type?: LearningItemType; kind?: LearningKind; className?: string }) {
  const info = learningType(type, kind)
  const value = type ?? "assignment"
  const tip = value === "event" ? `${info.label} · not counted in progress` : info.label
  return (
    <span data-item-type={value} className={cn("bw-type-chip", className)} title={tip}>
      <info.icon aria-hidden strokeWidth={2} />
      <span className="bw-type-chip-label">{info.label}</span>
    </span>
  )
}

/**
 * One assignment / exam / milestone / event: checkbox, type chip, title, optional course chip,
 * and when it's due. Clicking the title opens the task form. Events read lighter. `next` marks
 * the item a type panel is pointing at.
 */
export function CourseworkRow({ task, course, showCourse, next }: { task: Task; course?: Course; showCourse?: boolean; next?: boolean }) {
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const openForm = useUi((s) => s.openForm)
  const type = learningType(task.learningType, course?.kind)
  const event = task.learningType === "event"
  const overdue = !task.done && !!task.due && daysUntil(task.due) < 0
  const soon = !task.done && !!task.due && daysUntil(task.due) >= 0 && daysUntil(task.due) <= 2

  return (
    <li className={cn("bw-coursework-row group flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0 hover:bg-raised", next && "bg-raised/60 shadow-[inset_2px_0_0_var(--bw-text-2)]")} data-testid="coursework-row" data-next={next || undefined}>
      <Checkbox
        checked={task.done}
        onCheckedChange={() => toggleTask(task.id)}
        aria-label={task.done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
      />
      <span className="bw-type-slot"><TypeChip type={task.learningType} kind={course?.kind} /></span>
      <button type="button" onClick={() => openForm({ kind: "task", id: task.id })} className="min-w-0 flex-1 rounded-[4px] py-0.5 text-left" title={`Edit ${type.label.toLowerCase()}`}>
        <span className={cn("line-clamp-2 text-[13px] leading-snug break-words", event ? "text-ink-2" : "text-ink", next && "font-semibold", task.done && "text-faint line-through")} title={task.title}>{next && <span className="sr-only">Next up: </span>}{task.title}</span>
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
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-end gap-1 text-[11px] tabular-nums",
          overdue ? "text-amber" : soon || next ? "text-ink" : "text-muted-foreground",
        )}
      >
        {overdue && <CalendarClock className="size-3" aria-hidden />}
        {task.done ? "Done" : task.due && task.time ? (
          // In narrow rows the time drops under the date so the title keeps its room.
          <span className="bw-coursework-when"><span>{relativeDue(task.due)}</span><span className="bw-coursework-time"><span aria-hidden className="bw-coursework-sep">{"\u00a0·\u00a0"}</span>{formatTime(task.time)}</span></span>
        ) : courseworkWhen(task)}
      </span>
    </li>
  )
}
