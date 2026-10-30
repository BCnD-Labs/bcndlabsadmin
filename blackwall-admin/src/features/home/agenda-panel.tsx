import { format, isToday } from "date-fns"
import { CalendarDays, MapPin, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { EmptyState, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectTag } from "@/components/common/tags"
import { formatTime, parseKey, toDateKey, todayKey } from "@/lib/dates"
import type { CalendarEvent } from "@/lib/types"
import { services } from "@/services"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

export const byTime = (a: CalendarEvent, b: CalendarEvent) =>
  a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "")

export function EventRow({ event, showDate }: { event: CalendarEvent; showDate?: boolean }) {
  const openForm = useUi((s) => s.openForm)
  const projects = useProjectMap()
  return (
    <li>
      <button
        type="button"
        onClick={() => openForm({ kind: "event", id: event.id })}
        className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-16 shrink-0 pt-px font-mono text-xs text-muted-foreground tabular-nums">
          {showDate ? format(parseKey(event.date), "EEE d") : formatTime(event.start)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{event.title}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {showDate && <span>{formatTime(event.start)}</span>}
            {!showDate && event.end && <span>until {formatTime(event.end)}</span>}
            {event.location && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" aria-hidden />
                {event.location}
              </span>
            )}
          </span>
        </span>
        <ProjectTag project={event.projectId ? projects.get(event.projectId) : undefined} />
      </button>
    </li>
  )
}

export function AgendaPanel({ className }: { className?: string }) {
  const events = useWorkspace((s) => s.events)
  const openForm = useUi((s) => s.openForm)
  const [selected, setSelected] = useState<Date>(new Date())
  const selectedKey = toDateKey(selected)

  const eventDays = useMemo(() => [...new Set(events.map((e) => e.date))].map(parseKey), [events])
  const dayEvents = events.filter((e) => e.date === selectedKey).sort(byTime)
  const upcoming = events
    .filter((e) => e.date > selectedKey && e.date >= todayKey())
    .sort(byTime)
    .slice(0, 3)

  return (
    <Panel
      id="agenda"
      title="Agenda"
      icon={<CalendarDays />}
      badge={<SourceBadge status="local" hint="Local events only. No calendar provider is connected." />}
      className={className}
      actions={
        <Button size="sm" variant="outline" onClick={() => openForm({ kind: "event", defaults: { date: selectedKey } })}>
          <Plus /> Event
        </Button>
      }
      bodyClassName="flex flex-col"
    >
      <div className="flex justify-center border-b px-2 py-1">
        <Calendar
          mode="single"
          required
          selected={selected}
          onSelect={setSelected}
          modifiers={{ hasEvent: eventDays }}
          modifiersClassNames={{
            hasEvent:
              "after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:z-20 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-teal",
          }}
          className="bg-transparent p-1 [--cell-size:--spacing(7.5)]"
        />
      </div>
      <div className="flex-1 px-1.5 py-2">
        <div className="flex items-center justify-between px-2 pb-1">
          <h3 className="eyebrow">{isToday(selected) ? "Today" : format(selected, "EEEE, MMM d")}</h3>
          {!isToday(selected) && (
            <button type="button" className="text-xs text-teal hover:underline" onClick={() => setSelected(new Date())}>
              Back to today
            </button>
          )}
        </div>
        {dayEvents.length ? (
          <ul>{dayEvents.map((e) => <EventRow key={e.id} event={e} />)}</ul>
        ) : (
          <p className="px-2 py-2 text-sm text-muted-foreground">No events.</p>
        )}
        {upcoming.length > 0 && (
          <>
            <h3 className="eyebrow mt-2 px-2 pb-1">Coming up</h3>
            <ul>{upcoming.map((e) => <EventRow key={e.id} event={e} showDate />)}</ul>
          </>
        )}
        {!events.length && <EmptyState>Add an event to start your agenda.</EmptyState>}
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        External calendar
        <SourceBadge status={services.calendar.source.status} />
        <Link to="/settings/integrations" className="ml-auto text-teal hover:underline">
          Details
        </Link>
      </div>
    </Panel>
  )
}
