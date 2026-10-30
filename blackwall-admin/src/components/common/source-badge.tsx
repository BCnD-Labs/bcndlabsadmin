import { AlertTriangle, CircleDashed, FlaskConical, Loader2, Radio } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { SourceStatus } from "@/services/types"

const META: Record<SourceStatus, { label: string; icon: typeof Radio; className: string; hint: string }> = {
  live: { label: "Live", icon: Radio, className: "border-teal/50 text-teal", hint: "Fetched through your connection." },
  sample: { label: "Sample data", icon: FlaskConical, className: "border-amber/50 text-amber", hint: "Made-up data for previewing the layout. Turn it off in Settings → Appearance." },
  "not-connected": { label: "Not connected", icon: CircleDashed, className: "border-border text-muted-foreground", hint: "Add a connection in Settings → Connections." },
  error: { label: "Error", icon: AlertTriangle, className: "border-red/60 text-red-text", hint: "The connection failed. See Settings → Connections." },
  loading: { label: "Loading", icon: Loader2, className: "border-border text-muted-foreground [&_svg]:animate-spin", hint: "Fetching…" },
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
  const Icon = m.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex h-5 max-w-56 shrink-0 items-center gap-1 rounded-full border-2 px-2 font-mono text-[0.65rem] font-medium tracking-wide",
            m.className,
            className,
          )}
        >
          <Icon className="size-3 shrink-0" aria-hidden />
          <span className="uppercase">{m.label}</span>
          {detail && <span className="truncate normal-case opacity-80">· {detail}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{hint ?? m.hint}</TooltipContent>
    </Tooltip>
  )
}
