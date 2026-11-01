import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

/**
 * Spec §7 page header: the page's only <h1>, a one-line subtitle, and its actions
 * (at most one primary). The app header shows a breadcrumb, so this is the title.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  badge,
  back,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Next to the title, e.g. a SourceBadge. */
  badge?: ReactNode
  /** Detail pages: a small link back to the list above the title. */
  back?: { to: string; label: string }
  className?: string
}) {
  return (
    <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-1.5 inline-flex items-center gap-1 rounded-[4px] text-[11px] text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="size-3" aria-hidden />
            {back.label}
          </Link>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="min-w-0 font-heading text-2xl leading-tight font-bold tracking-tight break-words">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
