import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Spec §7 empty state, shown inside the panel it belongs to: a muted icon, a title,
 * a one-line hint and at most one action. "Not connected" uses NoSignal instead.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  roomy = false,
}: {
  icon?: LucideIcon
  title: ReactNode
  /** One-line hint under the title. */
  children?: ReactNode
  action?: ReactNode
  className?: string
  /** Extra space for first-use guidance rather than empty subsections. */
  roomy?: boolean
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 text-center", roomy ? "py-6" : "py-4", className)} data-testid="empty-state">
      {Icon && <Icon className="mb-1 size-5 text-faint" strokeWidth={1.6} aria-hidden />}
      <p className="text-sm text-ink-2">{title}</p>
      {children && <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
