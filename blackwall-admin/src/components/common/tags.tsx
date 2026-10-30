import { cn } from "@/lib/utils"
import type { DraftStatus, Project, ProjectColor } from "@/lib/types"

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
        "inline-flex max-w-full items-center gap-1.5 rounded-full border-2 border-edge bg-recessed px-2 py-px font-mono text-[0.68rem] text-muted-foreground",
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
    <span className={cn("inline-flex h-5 items-center rounded-full border-2 px-2 font-mono text-[0.68rem] uppercase", cls)}>
      {DRAFT_STATUS_LABEL[status]}
    </span>
  )
}
