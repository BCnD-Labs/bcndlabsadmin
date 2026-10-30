import { useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { parseKey, toDateKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"

/**
 * Month calendar for the daily log. Teal dot: a log was written that day.
 * Amber dot: open tasks due that day.
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
  const due = useMemo(() => [...new Set(tasks.filter((t) => !t.done && t.due).map((t) => t.due!))].map(parseKey), [tasks])

  const dot = "after:pointer-events-none after:absolute after:bottom-0.5 after:z-20 after:size-1 after:rounded-full"
  return (
    <Calendar
      mode="single"
      required
      showOutsideDays={false}
      selected={selected ? parseKey(selected) : undefined}
      onSelect={(d) => d && onSelect(toDateKey(d))}
      month={month}
      onMonthChange={onMonthChange}
      modifiers={{ logged, due }}
      modifiersClassNames={{
        logged: cn(dot, "after:left-[calc(50%-5px)] after:bg-teal"),
        due: cn("before:pointer-events-none before:absolute before:bottom-0.5 before:left-[calc(50%+1px)] before:z-20 before:size-1 before:rounded-full before:bg-amber"),
      }}
      className={cn("bg-transparent p-1 [--cell-size:--spacing(7.5)]", className)}
    />
  )
}

export function CalendarLegend() {
  return (
    <p className="flex items-center justify-center gap-3 text-[0.7rem] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-teal" aria-hidden /> Log written</span>
      <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber" aria-hidden /> Tasks due</span>
    </p>
  )
}
