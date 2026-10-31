import { format } from "date-fns"
import { daysUntil, parseKey, relativeDue } from "@/lib/dates"
import type { DateKey } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Spec §2 due chip: 1px border, a coloured square and the date. Amber when overdue. */
export function DueChip({ due, done, className }: { due: DateKey; done?: boolean; className?: string }) {
  const n = daysUntil(due)
  const overdue = !done && n < 0
  const label = overdue ? "overdue" : relativeDue(due).toLowerCase()
  return (
    <span
      title={`${overdue ? `${relativeDue(due)} · ` : ""}Due ${format(parseKey(due), "EEE, MMM d")}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-rim px-1.5 py-px font-mono text-[9px] whitespace-nowrap",
        overdue ? "text-amber" : "text-ink-2",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-[5px] rounded-[1px]", overdue ? "bg-amber" : n <= 0 ? "bg-red" : "bg-[#5F646D]")}
      />
      {label}
    </span>
  )
}
