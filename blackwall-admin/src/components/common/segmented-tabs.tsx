import { useRef, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export interface SegmentedTab<V extends string> {
  value: V
  label: string
  count?: number
}

/**
 * Segmented control (Mantine-style): a recessed track; the selected tab is a quiet
 * selected fill and neutral counts. Arrow keys / Home / End move and select.
 */
export function SegmentedTabs<V extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  className,
  tabClassName,
}: {
  tabs: SegmentedTab<V>[]
  value: V
  onChange: (v: V) => void
  label: string
  /** When set, tabs get ids `${idBase}-tab-${value}` and control `${idBase}-panel`. */
  idBase?: string
  className?: string
  tabClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.value === value)
    const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (n === undefined) return
    e.preventDefault()
    const next = tabs[(n + tabs.length) % tabs.length]
    onChange(next.value)
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus())
  }

  return (
    <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKey} className={cn("flex gap-1 rounded-[8px] border border-line-soft bg-well p-1", className)}>
      {tabs.map((t) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            data-value={t.value}
            id={idBase ? `${idBase}-tab-${t.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "flex h-[26px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[6px] text-xs font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
              on ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink",
              tabClassName,
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("min-w-4 rounded-full px-1.5 text-center text-[10px] leading-4 font-semibold tabular-nums", on ? "bg-ink-2/10 text-ink-2" : "bg-ink-2/10 text-muted-foreground")}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
