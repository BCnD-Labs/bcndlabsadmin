import { useState } from "react"
import { SLOT_COUNT } from "@/lib/home-slots"
import { HomeSlot } from "./home-slot"

/**
 * Home C: a 2×2 grid of user-chosen panels (spec §3). The layout lives in
 * prefs (`homeSlots`). The older home panels (tasks-panel, calendar-panel,
 * traffic-panel, dev-attention, activity-panel) stay in this folder for the
 * panel types still to come.
 */
export function HomePage() {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="home-grid">
      {Array.from({ length: SLOT_COUNT }, (_, i) => (
        <HomeSlot key={i} index={i} dragFrom={dragFrom} onDragFrom={setDragFrom} />
      ))}
    </div>
  )
}
