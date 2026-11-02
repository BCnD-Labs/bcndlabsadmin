import { useState } from "react"
import { SLOT_COUNT } from "@/lib/home-slots"
import { HomeSlot } from "./home-slot"

/**
 * Home overview: four user-chosen, content-sized panels. The layout lives in
 * prefs (`homeSlots`). The older home panels (tasks-panel, calendar-panel,
 * traffic-panel, dev-attention, activity-panel) stay in this folder for the
 * panel types still to come.
 */
export function HomePage() {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" data-testid="home-grid">
      {Array.from({ length: SLOT_COUNT }, (_, i) => (
        <HomeSlot key={i} index={i} dragFrom={dragFrom} onDragFrom={setDragFrom} />
      ))}
    </div>
  )
}
