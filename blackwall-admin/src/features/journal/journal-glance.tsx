import { CheckCircle2, Circle } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { SLOTS, reviewId } from "@shared/journal-review"

/** A day's check-ins at a glance (for the Planner), with a way into the Journal for that day. */
export function JournalGlance({ date }: { date: string }) {
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === date))
  const done = (slot: string) => !!entry?.entries?.some((i) => i.id === reviewId("daily", date, slot as never))
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2 text-[11px]" data-testid="journal-glance">
      {SLOTS.map((s) => (
        <span key={s.key} className={cn("inline-flex items-center gap-1", done(s.key) ? "text-green" : "text-faint")}>
          {done(s.key) ? <CheckCircle2 className="size-3" aria-hidden /> : <Circle className="size-3" aria-hidden />}{s.label}<span className="sr-only">{done(s.key) ? " check-in done" : " check-in not done"}</span>
        </span>
      ))}
      <Link to={`/journal?date=${date}`} className="ml-auto text-ink-2 underline-offset-2 hover:text-ink hover:underline">Open in Journal</Link>
    </div>
  )
}
