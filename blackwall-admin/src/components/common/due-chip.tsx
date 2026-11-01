import { format } from "date-fns"
import { daysUntil, parseKey, relativeDue } from "@/lib/dates"
import type { DateKey } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Due chip (Mantine light badge): tinted pill, a coloured square and the date. Amber when overdue. */
export function DueChip({ due, done, className }: { due: DateKey; done?: boolean; className?: string }) {
  const n = daysUntil(due)
  const overdue = !done && n < 0
  const label = overdue ? "overdue" : relativeDue(due).toLowerCase()
  return (
    <span
      title={`${overdue ? `${relativeDue(due)} · ` : ""}Due ${format(parseKey(due), "EEE, MMM d")}`}
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold whitespace-nowrap",
        overdue ? "bg-amber/12 text-amber" : n <= 0 ? "bg-red-soft text-red-light" : "bg-ink-2/8 text-ink-2",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-[5px] rounded-[1px]", overdue ? "bg-amber" : n <= 0 ? "bg-red-light" : "bg-check")}
      />
      {label}
    </span>
  )
}
