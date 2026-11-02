import { useMemo, type KeyboardEvent } from "react"
import { addDays, addMonths, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns"
import { parseKey, toDateKey, todayKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"

/**
 * Planner month grid, matching Ant Design's card Calendar: six fixed weeks with the
 * neighbouring months' days faded, day numbers in a 24px pill spread across the full card,
 * and year/month selectors (rendered in the card's title bar by <CalendarSelectors>).
 * Dots: grey = log written, red = open tasks due, amber = overdue. Arrow keys move the day.
 */
export function PlannerCalendar({ selected, month, onSelect }: { selected: string; month: Date; onSelect: (date: string) => void }) {
  const journal = useWorkspace((s) => s.journal)
  const tasks = useWorkspace((s) => s.tasks)
  const marks = useMemo(() => {
    const today = todayKey()
    const logged = new Set(journal.filter((j) => j.text.trim()).map((j) => j.id))
    const due = new Set<string>()
    const overdue = new Set<string>()
    for (const t of tasks) if (!t.done && t.due) (t.due < today ? overdue : due).add(t.due)
    return { logged, due, overdue }
  }, [journal, tasks])

  const start = startOfWeek(startOfMonth(month))
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))

  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    const next = toDateKey(addDays(parseKey(selected), step))
    onSelect(next)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus())
  }

  return (
    <div role="grid" aria-label={format(month, "MMMM yyyy")} onKeyDown={onKey} className="px-2 pt-2 pb-2">
      <div role="row" className="grid grid-cols-7 border-b border-line-soft pb-1.5 text-center text-base text-ink-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} role="columnheader">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 pt-1">
        {days.map((d) => {
          const key = toDateKey(d)
          const isSel = key === selected
          const outside = !isSameMonth(d, month)
          const dot = marks.overdue.has(key) ? "bg-amber" : marks.due.has(key) ? "bg-red" : marks.logged.has(key) ? "bg-muted-foreground" : ""
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-day={key}
              aria-selected={isSel}
              aria-label={format(d, "EEEE, MMMM d")}
              tabIndex={isSel ? 0 : -1}
              onClick={() => onSelect(key)}
              className="group relative flex h-10 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-[5px] px-1 text-[15px] tabular-nums",
                outside ? "text-faint" : "text-ink",
                isSel ? "bg-red text-white" : isToday(d) ? "ring-1 ring-red" : "group-hover:bg-raised",
              )}>
                {format(d, "dd")}
              </span>
              {dot && <span className={cn("absolute bottom-1 size-1 rounded-full", dot, outside && "opacity-50")} aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2026, i, 1), "MMM"))

/** Year and month selects for the calendar card's title bar (Ant's Calendar header). */
export function CalendarSelectors({ month, onMonth }: { month: Date; onMonth: (m: Date) => void }) {
  const year = month.getFullYear()
  const years = Array.from({ length: 11 }, (_, i) => year - 5 + i)
  const select = "h-7 rounded-md border border-line bg-well pr-1 pl-1.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
  return (
    <span className="flex shrink-0 items-center gap-1">
      <select aria-label="Year" className={select} value={year} onChange={(e) => onMonth(new Date(Number(e.target.value), month.getMonth(), 1))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select aria-label="Month" className={select} value={month.getMonth()} onChange={(e) => onMonth(new Date(year, Number(e.target.value), 1))}>
        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>
      <button type="button" aria-label="Previous month" className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-raised hover:text-ink" onClick={() => onMonth(addMonths(month, -1))}>‹</button>
      <button type="button" aria-label="Next month" className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-raised hover:text-ink" onClick={() => onMonth(addMonths(month, 1))}>›</button>
    </span>
  )
}
