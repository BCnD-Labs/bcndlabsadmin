import { useRef, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export interface SegmentedTab<V extends string> {
  value: V
  label: string
  count?: number
}

/**
 * Spec §2 segmented tabs: a well track; the selected tab gets the selected fill,
 * a 2px ledge and a red count badge. Arrow keys / Home / End move and select.
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
    <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKey} className={cn("bw-well flex gap-[3px] p-[3px]", className)}>
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
              "flex h-6 flex-1 items-center justify-center gap-1.5 rounded-[5px] border-r-2 border-b-2 border-transparent font-mono text-[11px] transition-colors duration-150",
              on ? "border-ledge-hi bg-selected text-white" : "text-muted-foreground hover:text-ink",
              tabClassName,
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded-[3px] px-1 text-[9px] tabular-nums", on ? "bg-red text-white" : "bg-line text-muted-foreground")}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
