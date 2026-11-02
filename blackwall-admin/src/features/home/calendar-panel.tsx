import { format } from "date-fns"
import { NotebookPen } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { todayKey } from "@/lib/dates"
import { useWorkspace } from "@/stores/workspace"
import { CalendarLegend, JournalCalendar } from "@/features/journal/journal-calendar"
import { logHref } from "@/lib/routes"

/** Mini calendar; clicking a day opens that day's log. */
export function CalendarPanel({ className }: { className?: string }) {
  const navigate = useNavigate()
  const today = todayKey()
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === today))
  const preview = entry?.text.trim().split("\n").filter(Boolean).slice(0, 4) ?? []

  return (
    <Panel id="calendar" tool="calendar" command="month" className={className} bodyClassName="flex flex-col">
      <div className="flex flex-col items-center border-b px-2 pt-1 pb-2">
        <JournalCalendar selected={today} onSelect={(d) => navigate(logHref(d))} />
        <CalendarLegend />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="bw-label">Today's log · {format(new Date(), "MMM d")}</h3>
        </div>
        {preview.length ? (
          <button
            type="button"
            onClick={() => navigate(logHref(today))}
            className="rounded-md border border-border/70 bg-well/60 px-2.5 py-2 text-left text-sm whitespace-pre-line text-muted-foreground hover:border-ledge-hi"
          >
            <span className="line-clamp-4">{preview.join("\n")}</span>
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing written yet.</p>
        )}
        <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => navigate(logHref(today))}>
          <NotebookPen /> {preview.length ? "Continue today's log" : "Write today's log"}
        </Button>
      </div>
    </Panel>
  )
}
