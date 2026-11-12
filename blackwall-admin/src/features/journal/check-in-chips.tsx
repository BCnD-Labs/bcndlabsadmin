import { Check } from "lucide-react"
import { useState } from "react"
import { compareTasks } from "@/features/work/task-utils"
import { todayKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { SLOTS, reviewId, slotForHour, type Slot } from "@shared/journal-review"
import { isForToday } from "@shared/task-rules"
import { CheckInDialog } from "./check-in-dialog"

/** Morning, Afternoon and Evening as small buttons in the log: grey until saved, then marked with a check. Each opens that check-in. */
export function CheckInChips({ day }: { day: string }) {
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === day))
  const tasks = useWorkspace((s) => s.tasks)
  const [slot, setSlot] = useState<Slot | null>(null)
  const now = day === todayKey() ? slotForHour(new Date().getHours()) : undefined
  const titles = tasks.filter((t) => t.kind !== "event" && !t.done && isForToday(t, day)).sort(compareTasks).slice(0, 6).map((t) => t.title.trim().replace(/\s+/g, " ")).filter(Boolean)
  return (
    <>
      <div className="mac-checkin-chips" role="group" aria-label="Check-ins">
        {SLOTS.map((s) => {
          const done = !!entry?.entries?.some((i) => i.id === reviewId("daily", day, s.key))
          return (
            <button key={s.key} type="button" data-done={done} data-now={now === s.key && !done} onClick={() => setSlot(s.key)} aria-label={`${s.label} check-in, ${done ? "saved, edit" : "not saved"}`}
              className={cn("mac-checkin-chip", done && "is-done")}>
              <span>{s.label}</span>{done && <Check aria-hidden />}
            </button>
          )
        })}
      </div>
      {slot && <CheckInDialog key={`${day}${slot}`} period="daily" anchor={day} slot={slot} todayTitles={titles} onClose={() => setSlot(null)} />}
    </>
  )
}
