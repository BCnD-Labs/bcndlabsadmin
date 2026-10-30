import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DraftStatus, Priority, Project, ProjectColor } from "@/lib/types"

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
}

const PRIORITY_STYLE: Record<Priority, { icon: typeof ArrowUp; className: string }> = {
  urgent: { icon: AlertTriangle, className: "text-red-text" },
  high: { icon: ArrowUp, className: "text-amber" },
  medium: { icon: Minus, className: "text-muted-foreground" },
  low: { icon: ArrowDown, className: "text-muted-foreground" },
}

export function PriorityTag({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const { icon: Icon, className } = PRIORITY_STYLE[priority]
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", className)}
      title={`${PRIORITY_LABEL[priority]} priority`}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className={cn(compact && "sr-only")}>{PRIORITY_LABEL[priority]}</span>
    </span>
  )
}

export const PROJECT_DOT: Record<ProjectColor, string> = {
  teal: "bg-teal",
  amber: "bg-amber",
  red: "bg-red",
  slate: "bg-muted-foreground",
}

export function ProjectTag({ project, className }: { project?: Project; className?: string }) {
  if (!project) return null
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-sm border bg-recessed px-1.5 py-px font-mono text-[0.7rem] text-muted-foreground",
        className,
      )}
      title={project.name}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", PROJECT_DOT[project.color])} aria-hidden />
      {project.code}
    </span>
  )
}

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  idea: "Idea",
  drafting: "Drafting",
  review: "In review",
  ready: "Ready",
}

export function DraftStatusTag({ status }: { status: DraftStatus }) {
  const cls =
    status === "ready"
      ? "border-teal/50 text-teal"
      : status === "review"
        ? "border-amber/50 text-amber"
        : "border-border text-muted-foreground"
  return (
    <span className={cn("inline-flex h-5 items-center rounded-sm border px-1.5 text-xs", cls)}>
      {DRAFT_STATUS_LABEL[status]}
    </span>
  )
}
