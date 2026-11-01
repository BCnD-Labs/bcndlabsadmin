import { useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { parseKey, toDateKey, todayKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"

/**
 * Month calendar for the daily log, with the same day markers as the header
 * calendar: grey = a saved log, red = open tasks due, amber = overdue.
 */
export function JournalCalendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  className,
}: {
  selected?: string
  onSelect: (date: string) => void
  month?: Date
  onMonthChange?: (m: Date) => void
  className?: string
}) {
  const journal = useWorkspace((s) => s.journal)
  const tasks = useWorkspace((s) => s.tasks)
  const logged = useMemo(() => journal.map((j) => parseKey(j.id)), [journal])
  const { due, overdue } = useMemo(() => {
    const today = todayKey()
    const days = [...new Set(tasks.filter((t) => !t.done && t.due).map((t) => t.due!))]
    return { due: days.filter((d) => d >= today).map(parseKey), overdue: days.filter((d) => d < today).map(parseKey) }
  }, [tasks])

  // Literal class strings, so Tailwind can see them.
  const after = "after:pointer-events-none after:absolute after:bottom-0.5 after:z-20 after:size-1 after:rounded-[1px]"
  const before = "before:pointer-events-none before:absolute before:bottom-0.5 before:z-20 before:size-1 before:rounded-[1px]"
  return (
    <Calendar
      mode="single"
      required
      showOutsideDays={false}
      selected={selected ? parseKey(selected) : undefined}
      onSelect={(d) => d && onSelect(toDateKey(d))}
      month={month}
      onMonthChange={onMonthChange}
      modifiers={{ logged, due, overdue }}
      modifiersClassNames={{
        logged: cn(after, "after:left-[calc(50%-5px)] after:bg-muted-foreground"),
        due: cn(before, "before:left-[calc(50%+1px)] before:bg-red"),
        overdue: cn(before, "before:left-[calc(50%+1px)] before:bg-amber"),
      }}
      className={cn("bg-transparent p-1 [--cell-size:--spacing(7.5)]", className)}
    />
  )
}

export function CalendarLegend() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-[1.5px] bg-muted-foreground" aria-hidden /> Log</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-[1.5px] bg-red" aria-hidden /> Tasks due</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-[1.5px] bg-amber" aria-hidden /> Overdue</span>
    </p>
  )
}
