import { Check } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface FilterOption {
  value: string
  label: string
  count?: number
  icon?: ReactNode
}

/**
 * Pick any mix of options, or All. Empty selection means All. Used wherever several
 * accounts, platforms, brands or item types could be shown at once. Chips use the compact
 * control height (28px desktop, 32px touch). By default the row scrolls sideways; `wrap`
 * wraps it instead so no chip is ever cut off.
 */
export function FilterChips({ label, options, value, onChange, className, wrap = false, allCount }: { label: string; options: FilterOption[]; value: string[]; onChange: (next: string[]) => void; className?: string; wrap?: boolean; allCount?: number }) {
  const live = value.filter((v) => options.some((o) => o.value === v))
  const all = live.length === 0
  const toggle = (v: string) => {
    const next = live.includes(v) ? live.filter((x) => x !== v) : [...live, v]
    onChange(next.length === options.length ? [] : next)
  }
  const chip = "inline-flex h-[var(--bw-control-sm)] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] transition-colors"
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 items-center gap-1.5", wrap ? "flex-wrap" : "overflow-x-auto [scrollbar-width:none]", className)}>
      <span className="mr-0.5 shrink-0 text-[11px] font-medium text-faint uppercase tracking-[0.04em]">{label}</span>
      <button type="button" aria-pressed={all} onClick={() => onChange([])} className={cn(chip, all ? "bg-selected text-ink" : "bg-well text-muted-foreground hover:text-ink")}>
        {all && <Check className="size-3" aria-hidden />}All
        {allCount != null && <span className={cn("text-[11px] tabular-nums", all ? "text-muted-foreground" : "text-faint")}>{allCount}</span>}
      </button>
      {options.map((o) => {
        const on = live.includes(o.value)
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => toggle(o.value)} className={cn(chip, on ? "bg-selected text-ink" : "bg-well text-muted-foreground hover:text-ink")}>
            {on ? <Check className="size-3" aria-hidden /> : o.icon}
            {o.label}
            {o.count != null && <span className={cn("text-[11px] tabular-nums", on ? "text-muted-foreground" : "text-faint")}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
