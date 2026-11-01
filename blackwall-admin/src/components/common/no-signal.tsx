import type { ProviderId } from "@shared/connections"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { SourceBadge } from "./source-badge"

/**
 * The SourceBadge `not-connected` state as a panel body: "[ NO SIGNAL ]", what's
 * missing, and a button that opens Settings → Connections. Different from an empty slot
 * ("[ EMPTY ]"), which means nothing has been chosen.
 */
export function NoSignal({
  message = "No source connected.",
  add,
  action = "Connections",
  onNavigate,
  badge = true,
  className,
}: {
  message?: string
  /** Start connecting this provider when Connections opens. */
  add?: ProviderId
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
      <Button
        variant="outline"
        className="mt-1"
        onClick={() => {
          onNavigate?.()
          useUi.getState().openSettings("connections", add)
        }}
      >
        {action} →
      </Button>
    </div>
  )
}
