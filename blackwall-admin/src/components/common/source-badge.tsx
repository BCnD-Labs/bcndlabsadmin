import { Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { SourceStatus } from "@/services/types"

/** Status markers are small squares (spec §1); red only marks failures. */
const META: Record<SourceStatus, { label: string; square: string; className: string; hint: string }> = {
  live: { label: "Connected", square: "bg-green", className: "bg-green/12 text-green", hint: "Data fetched through your connection. This does not indicate continuous monitoring." },
  sample: { label: "Sample data", square: "bg-amber", className: "bg-amber/12 text-amber", hint: "Made-up data for previewing the layout. Turn it off in Settings → Appearance." },
  "not-connected": { label: "Not connected", square: "bg-faint", className: "bg-ink-2/8 text-muted-foreground", hint: "Add a connection in Settings → Connections." },
  error: { label: "Error", square: "bg-red-light", className: "bg-red-soft text-red-light", hint: "The connection failed. See Settings → Connections." },
  loading: { label: "Loading", square: "", className: "bg-ink-2/8 text-muted-foreground", hint: "Fetching…" },
}

/** Shown on panels whose data comes from outside Blackwall. Local records don't get one. */
export function SourceBadge({
  status,
  hint,
  detail,
  className,
  focusable = true,
}: {
  /** False inside another interactive element (e.g. a card link): no tab stop, native title instead of a tooltip. */
  focusable?: boolean
  status: SourceStatus
  hint?: string
  /** Appended after the label, e.g. the account name. */
  detail?: string
  className?: string
}) {
  const m = META[status]
  if (!focusable) {
    return (
      <span title={hint ?? m.hint} className={cn("inline-flex h-5 max-w-56 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium", m.className, className)}>
        {status === "loading" ? <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden /> : <span className={cn("size-1.5 shrink-0 rounded-[1.5px]", m.square)} aria-hidden />}
        <span>{m.label}</span>
        {detail && <span className="truncate normal-case">· {detail}</span>}
      </span>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex h-5 max-w-56 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium",
            m.className,
            className,
          )}
        >
          {status === "loading" ? (
            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <span className={cn("size-1.5 shrink-0 rounded-[1.5px]", m.square)} aria-hidden />
          )}
          <span>{m.label}</span>
          {detail && <span className="truncate normal-case">· {detail}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{hint ?? `${m.hint}${detail ? ` Source: ${detail}.` : ""}`}</TooltipContent>
    </Tooltip>
  )
}
