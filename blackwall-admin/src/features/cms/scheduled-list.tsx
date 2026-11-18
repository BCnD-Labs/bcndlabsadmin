import { CalendarClock, TriangleAlert } from "lucide-react"
import { useEffect } from "react"
import { format } from "date-fns"
import { scheduleKey, type ScheduledPost } from "@shared/site"
import { Panel } from "@/components/common/panel"
import { timeFmt } from "@/lib/dates"
import { useSchedules } from "@/services/site"

/** The posts of one site waiting to go out: when each runs next, and why one didn't go out, if it didn't. Nothing is shown when nothing is waiting. */
export function ScheduledList({ pick }: { pick: (s: ScheduledPost) => boolean }) {
  const { items, load } = useSchedules()
  useEffect(() => { void load() }, [load])
  const mine = items.filter(pick).sort((a, b) => a.publishAt.localeCompare(b.publishAt))
  if (!mine.length) return null
  return (
    <Panel category="website" title="Scheduled" meta={`${mine.length} waiting`} bodyClassName="py-1" data-testid="scheduled-list">
      <ul>
        {mine.map((s) => (
          <li key={scheduleKey(s)} className="grid gap-0.5 border-t border-line-soft px-3.5 py-2 first:border-t-0">
            <span className="flex items-center gap-2 text-[13px] text-ink"><CalendarClock className="size-3.5 shrink-0 text-muted-foreground" /><b className="min-w-0 flex-1 truncate">{s.post.title}</b><span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">{s.error ? "was due" : "next run"} {format(new Date(s.publishAt), `MMM d, ${timeFmt()}`)}</span></span>
            {s.error && <span role="alert" className="flex items-start gap-1.5 pl-5 text-[11.5px] text-red-text"><TriangleAlert className="mt-0.5 size-3 shrink-0" />{s.error} Blackwall tries again every 10 minutes.{s.late ? " It is running late because the server wasn't running at the scheduled time." : ""}</span>}
            {s.mode === "pr" && !s.error && <span className="pl-5 text-[11px] text-faint">Opens a pull request instead of publishing live.</span>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
