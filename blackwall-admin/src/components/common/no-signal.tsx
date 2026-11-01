import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SourceBadge } from "./source-badge"

/**
 * The SourceBadge `not-connected` state as a panel body: "[ NO SIGNAL ]", what's
 * missing, and a link to Settings → Connections. Different from an empty slot
 * ("[ EMPTY ]"), which means nothing has been chosen.
 */
export function NoSignal({
  message = "No source connected.",
  to = "/settings/connections",
  action = "Connections",
  onNavigate,
  badge = true,
  className,
}: {
  message?: string
  /** Defaults to Settings → Connections; pass `?add=<provider>` to preselect one. */
  to?: string
  action?: string
  onNavigate?: () => void
  /** Off when the panel header already shows the SourceBadge. */
  badge?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2.5 px-4 py-8 text-center", className)} data-testid="no-signal">
      {badge && <SourceBadge status="not-connected" />}
      <p className="font-mono text-[11px] font-semibold tracking-[0.3em] text-ink-2">[ NO SIGNAL ]</p>
      <p className="max-w-64 text-[11px] leading-relaxed text-muted-foreground">{message}</p>
      <Button variant="outline" asChild className="mt-1">
        <Link to={to} onClick={onNavigate}>
          {action} →
        </Link>
      </Button>
    </div>
  )
}
