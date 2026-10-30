import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Dashboard panel: compact header row, plain body. */
export function Panel({
  title,
  icon,
  badge,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: ReactNode
  icon?: ReactNode
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
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground",
        className,
      )}
    >
      <header className="flex min-h-11 flex-wrap items-center gap-2 border-b px-3 py-1.5">
        {icon && <span className="text-teal [&_svg]:size-4">{icon}</span>}
        <h2 id={headingId} className="text-sm font-bold">
          {title}
        </h2>
        {badge}
        <div className="ml-auto flex items-center gap-1">{actions}</div>
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
          <h1 className="text-xl font-bold">{title}</h1>
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
