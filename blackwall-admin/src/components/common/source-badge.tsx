import { Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { SourceStatus } from "@/services/types"

/** Status markers are small squares (spec §1); red only marks failures. */
const META: Record<SourceStatus, { label: string; square: string; className: string; hint: string }> = {
  live: { label: "Live", square: "bg-green", className: "text-ink-2", hint: "Fetched through your connection." },
  sample: { label: "Sample data", square: "bg-amber", className: "text-amber", hint: "Made-up data for previewing the layout. Turn it off in Settings → Appearance." },
  "not-connected": { label: "Not connected", square: "bg-faint", className: "text-muted-foreground", hint: "Add a connection in Settings → Connections." },
  error: { label: "Error", square: "bg-red", className: "text-red-text", hint: "The connection failed. See Settings → Connections." },
  loading: { label: "Loading", square: "", className: "text-muted-foreground", hint: "Fetching…" },
}

/** Shown on panels whose data comes from outside Blackwall. Local records don't get one. */
export function SourceBadge({
  status,
  hint,
  detail,
  className,
}: {
  status: SourceStatus
  hint?: string
  /** Appended after the label, e.g. the account name. */
  detail?: string
  className?: string
}) {
  const m = META[status]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex h-5 max-w-56 shrink-0 items-center gap-1.5 rounded-[5px] border border-rim px-1.5 font-mono text-[10px] tracking-wide",
            m.className,
            className,
          )}
        >
          {status === "loading" ? (
            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <span className={cn("size-1.5 shrink-0 rounded-[1.5px]", m.square)} aria-hidden />
          )}
          <span className="uppercase">{m.label}</span>
          {detail && <span className="truncate normal-case">· {detail}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{hint ?? m.hint}</TooltipContent>
    </Tooltip>
  )
}
