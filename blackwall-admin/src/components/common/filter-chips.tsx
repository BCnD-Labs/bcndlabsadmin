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
 * accounts, platforms or brands could be shown at once.
 */
export function FilterChips({ label, options, value, onChange, className }: { label: string; options: FilterOption[]; value: string[]; onChange: (next: string[]) => void; className?: string }) {
  const live = value.filter((v) => options.some((o) => o.value === v))
  const all = live.length === 0
  const toggle = (v: string) => {
    const next = live.includes(v) ? live.filter((x) => x !== v) : [...live, v]
    onChange(next.length === options.length ? [] : next)
  }
  const chip = "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] transition-colors"
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]", className)}>
      <span className="mr-0.5 shrink-0 text-[11px] font-medium text-faint uppercase tracking-[0.04em]">{label}</span>
      <button type="button" aria-pressed={all} onClick={() => onChange([])} className={cn(chip, all ? "bg-selected text-ink" : "bg-well text-muted-foreground hover:text-ink")}>
        {all && <Check className="size-3" aria-hidden />}All
      </button>
      {options.map((o) => {
        const on = live.includes(o.value)
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => toggle(o.value)} className={cn(chip, on ? "bg-selected text-ink" : "bg-well text-muted-foreground hover:text-ink")}>
            {on ? <Check className="size-3" aria-hidden /> : o.icon}
            {o.label}
            {o.count != null && <span className="text-[11px] text-faint">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
