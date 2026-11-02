import { Link } from "react-router-dom"
import { projectHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { DraftStatus, Project, ProjectColor, ProjectStatus } from "@/lib/types"

export type Tone = "ok" | "warn" | "error" | "off"

/** Spec §7 status marker: a small square. Green healthy, amber degraded, red failed, faint off. */
export function StatusMarker({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-[1.5px]",
        tone === "ok" && "bg-green",
        tone === "warn" && "bg-amber",
        tone === "error" && "bg-red",
        tone === "off" && "bg-faint",
        className,
      )}
    />
  )
}

/** A project's label colour. These are names you pick, not statuses, so none of them is the status green. */
export const PROJECT_DOT: Record<ProjectColor, string> = {
  teal: "bg-[#74aab9]",
  amber: "bg-amber",
  red: "bg-red",
  slate: "bg-muted-foreground",
}

/** The same project colours as CSS colours, for icon tiles and sparklines. */
export const PROJECT_HEX: Record<ProjectColor, string> = {
  teal: "#74aab9",
  amber: "var(--bw-amber)",
  red: "var(--bw-red-light)",
  slate: "var(--bw-text-2)",
}

/** A project's icon tile: its code on a tint of its colour (same shape as the category tiles). */
export function ProjectTile({ project, size = 36 }: { project: Project; size?: number }) {
  const c = PROJECT_HEX[project.color]
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[9px] font-heading font-bold tracking-wide"
      style={{ width: size, height: size, fontSize: size < 32 ? 9 : 11, color: c, background: `color-mix(in srgb, ${c} 20%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 38%, transparent)` }}
    >
      {(project.code || project.name).slice(0, 3).toUpperCase()}
    </span>
  )
}

export function ProjectTag({ project, className, asLink = false }: { project?: Project; className?: string; asLink?: boolean }) {
  if (!project) return null
  const cls = cn("inline-flex h-5 max-w-full shrink-0 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[11px] font-medium text-ink-2", asLink && "min-h-8 hover:bg-selected hover:text-ink md:min-h-0", className)
  const content = <><span className={cn("size-1.5 shrink-0 rounded-[1.5px]", PROJECT_DOT[project.color])} aria-hidden />{project.code}</>
  return asLink ? <Link to={projectHref(project.id)} className={cls} title={project.name}>{content}</Link> : <span className={cls} title={project.name}>{content}</span>
}

const PROJECT_TONE: Record<ProjectStatus, Tone> = { active: "ok", planned: "off", paused: "warn", done: "off" }

/** "■ Active" in muted text; the square carries the state. */
export function ProjectStatusLabel({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground capitalize", className)}>
      <StatusMarker tone={PROJECT_TONE[status]} />
      {status}
    </span>
  )
}

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  idea: "Idea",
  drafting: "Drafting",
  review: "In review",
  ready: "Ready",
}

const DRAFT_TONE: Record<DraftStatus, Tone> = { idea: "off", drafting: "off", review: "warn", ready: "ok" }

export function DraftStatusTag({ status }: { status: DraftStatus }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-bold tracking-[0.03em] uppercase bg-ink-2/8 text-ink-2">
      <StatusMarker tone={DRAFT_TONE[status]} />
      {DRAFT_STATUS_LABEL[status]}
    </span>
  )
}
