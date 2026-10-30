import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { EventRow, byTime } from "@/features/home/agenda-panel"
import { formatTime, toDateKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { services } from "@/services"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

export function CalendarPage() {
  const events = useWorkspace((s) => s.events)
  const openForm = useUi((s) => s.openForm)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) }),
    [month],
  )
  const byDay = useMemo(() => {
    const m = new Map<string, typeof events>()
    for (const e of [...events].sort(byTime)) m.set(e.date, [...(m.get(e.date) ?? []), e])
    return m
  }, [events])
  const monthEvents = events
    .filter((e) => e.date.startsWith(format(month, "yyyy-MM")))
    .sort(byTime)

  return (
    <>
      <PageHeader
        title="Calendar"
        badge={<SourceBadge status="local" />}
        description={
          <span className="inline-flex items-center gap-2">
            Local events. External calendar <SourceBadge status={services.calendar.source.status} />
          </span>
        }
        actions={<Button onClick={() => openForm({ kind: "event" })}><Plus /> New event</Button>}
      />
      <div className="grid gap-3 xl:grid-cols-[1fr_20rem]">
        <section className="rounded-lg border bg-card" aria-label={format(month, "MMMM yyyy")}>
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <h2 className="font-bold">{format(month, "MMMM yyyy")}</h2>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft /></Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
              <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight /></Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-7">
              {days.slice(0, 7).map((d) => (
                <div key={d.toISOString()} className="eyebrow border-b px-2 py-1.5">{format(d, "EEE")}</div>
              ))}
              {days.map((d) => {
                const key = toDateKey(d)
                const list = byDay.get(key) ?? []
                return (
                  <div
                    key={key}
                    className={cn(
                      "group min-h-24 border-r border-b border-border/60 p-1 [&:nth-child(7n)]:border-r-0",
                      !isSameMonth(d, month) && "bg-recessed/50 text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-md font-mono text-xs",
                          isToday(d) && "bg-primary font-bold text-primary-foreground",
                        )}
                      >
                        {format(d, "d")}
                      </span>
                      <button
                        type="button"
                        onClick={() => openForm({ kind: "event", defaults: { date: key } })}
                        className="rounded-sm p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                        aria-label={`Add event on ${format(d, "MMMM d")}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <ul className="mt-0.5 space-y-0.5">
                      {list.slice(0, 3).map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => openForm({ kind: "event", id: e.id })}
                            className="block w-full truncate rounded-sm border-l-2 border-teal bg-recessed px-1 py-px text-left text-xs hover:bg-muted"
                          >
                            {e.start && <span className="font-mono text-muted-foreground">{formatTime(e.start).replace(":00", "")} </span>}
                            {e.title}
                          </button>
                        </li>
                      ))}
                      {list.length > 3 && <li className="px-1 text-xs text-muted-foreground">+{list.length - 3} more</li>}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
        <section className="rounded-lg border bg-card" aria-labelledby="month-list">
          <h2 id="month-list" className="border-b px-3 py-2 text-sm font-bold">This month · {monthEvents.length}</h2>
          {monthEvents.length ? (
            <ul className="p-1.5">{monthEvents.map((e) => <EventRow key={e.id} event={e} showDate />)}</ul>
          ) : (
            <p className="p-3 text-sm text-muted-foreground">No events this month.</p>
          )}
        </section>
      </div>
    </>
  )
}
