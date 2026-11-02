import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUi } from "@/stores/ui"
import { usePrefs } from "@/stores/prefs"
import { WorkspaceGrid } from "@/components/common/workspace-grid"
import { useState } from "react"
import { SLOT_COUNT } from "@/lib/home-slots"
import { WorkspaceContext, WorkspaceSummary } from "./workspace-context"
import { HomeSlot } from "./home-slot"

/** Home's saved module choices use shared grid spans; project/log context joins
 * the same grid. Geometry follows the module role rather than a fixed 2×2.
 */
export function HomePage() {
  const sizing = usePrefs((s) => s.homeSizing)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><WorkspaceSummary /><Button variant="outline" size="sm" onClick={() => useUi.getState().openSettings("dashboard")}><SlidersHorizontal /> Customize dashboard</Button></div>
      <WorkspaceGrid className="bw-home-grid" data-sizing={sizing} data-testid="home-grid">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <HomeSlot key={i} index={i} dragFrom={dragFrom} onDragFrom={setDragFrom} />
        ))}
        <WorkspaceContext />
      </WorkspaceGrid>
    </>
  )
}
