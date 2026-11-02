import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUi } from "@/stores/ui"
import { useState } from "react"
import { SLOT_COUNT } from "@/lib/home-slots"
import { WorkspaceContext } from "./workspace-context"
import { HomeSlot } from "./home-slot"
import { StatCards } from "./stat-cards"

/**
 * Home follows shadcn's dashboard-01 structure: a KPI card row, then content-sized
 * sections. The four chosen modules form a bento (wide + narrow, narrow + wide);
 * projects, today's log and linked services close it out. Cards in a row share a
 * height, and long content scrolls inside its card instead of growing the page.
 */
export function HomePage() {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  return (
    <div className="@container/main mx-auto grid w-full max-w-[var(--bw-page-max)] gap-3">
      <StatCards />
      <div className="flex justify-end">
        <Button variant="quiet" size="sm" onClick={() => useUi.getState().openSettings("dashboard")}><SlidersHorizontal /> Customize dashboard</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 @2xl/main:grid-cols-2 @6xl/main:grid-cols-3" data-testid="home-grid">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <HomeSlot key={i} index={i} dragFrom={dragFrom} onDragFrom={setDragFrom} />
        ))}
        <WorkspaceContext />
      </div>
    </div>
  )
}
