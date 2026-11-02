import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface StatItem {
  label: string
  value: ReactNode
  /** Small text under the value, e.g. "2 need review". */
  sub?: ReactNode
  tone?: "warn" | "error"
  icon?: ReactNode
}

/** A row of small numbers in one card, divided by hairlines (Mantine "stats group"). */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <dl
      className={cn(
        "bw-panel grid grid-cols-2 divide-line sm:flex sm:divide-x [&>div]:border-line max-sm:[&>div:nth-child(-n+2)]:border-b max-sm:[&>div:nth-child(odd)]:border-r",
        className,
      )}
    >
      {items.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-2.5">
          <dt className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            {s.icon}
            {s.label}
          </dt>
          <dd className={cn("font-heading text-xl leading-tight font-bold tabular-nums", s.tone === "warn" && "text-amber", s.tone === "error" && "text-red-text")}>
            {s.value}
          </dd>
          {s.sub && <dd className="truncate text-[11px] text-faint">{s.sub}</dd>}
        </div>
      ))}
    </dl>
  )
}
