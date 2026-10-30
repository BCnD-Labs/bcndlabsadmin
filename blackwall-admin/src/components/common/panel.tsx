import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type Accent = "teal" | "amber" | "magenta" | "lime" | "blue" | "red"

const CHIP: Record<Accent, string> = {
  teal: "bg-teal",
  amber: "bg-amber",
  magenta: "bg-magenta",
  lime: "bg-lime",
  blue: "bg-blue",
  red: "bg-red",
}

/**
 * Dashboard panel: a neo-brutal block (chunky border, hard shadow, rounded) with
 * a terminal-style title bar. The accent colours the icon chip so each area of
 * the app is recognisable at a glance.
 */
export function Panel({
  title,
  icon,
  accent = "teal",
  badge,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: ReactNode
  icon?: ReactNode
  accent?: Accent
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("brutal flex min-w-0 flex-col overflow-hidden rounded-xl bg-card text-card-foreground", className)}
    >
      <header className="flex min-h-12 flex-wrap items-center gap-2.5 border-b-2 border-edge bg-recessed/70 px-3 py-1.5">
        {icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md border-2 border-black text-black shadow-brutal-sm [&_svg]:size-4",
              CHIP[accent],
            )}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <h2 id={headingId} className="font-heading text-sm font-bold tracking-wide uppercase">
          {title}
        </h2>
        {badge}
        <div className="ml-auto flex items-center gap-1.5">{actions}</div>
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}

export function EmptyState({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Page heading for secondary views — deliberately small. */
export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}
