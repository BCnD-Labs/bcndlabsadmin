import { CircleDashed, FlaskConical, HardDrive } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { SourceStatus } from "@/services/types"

const META: Record<
  SourceStatus,
  { label: string; icon: typeof HardDrive; className: string; hint: string }
> = {
  local: {
    label: "Local",
    icon: HardDrive,
    className: "border-teal/40 text-teal",
    hint: "Records saved in this browser.",
  },
  demo: {
    label: "Demo data",
    icon: FlaskConical,
    className: "border-amber/50 text-amber",
    hint: "Sample data from a demo adapter. Not live.",
  },
  "not-connected": {
    label: "Not connected",
    icon: CircleDashed,
    className: "border-border text-muted-foreground",
    hint: "No integration configured yet.",
  },
}

export function SourceBadge({
  status,
  hint,
  className,
}: {
  status: SourceStatus
  hint?: string
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
            "inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border px-1.5 font-mono text-[0.68rem] tracking-wide uppercase",
            m.className,
            className,
          )}
        >
          <Icon className="size-3" aria-hidden />
          {m.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint ?? m.hint}</TooltipContent>
    </Tooltip>
  )
}
