import { WorkspaceGrid } from "@/components/common/workspace-grid"
import { useState } from "react"
import { SLOT_COUNT } from "@/lib/home-slots"
import { WorkspaceContext, WorkspaceSummary } from "./workspace-context"
import { HomeSlot } from "./home-slot"

/** Home's saved module choices use shared grid spans; project/log context joins
 * the same grid. Geometry follows the module role rather than a fixed 2×2.
 */
export function HomePage() {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  return (
    <>
      <WorkspaceSummary />
      <WorkspaceGrid data-testid="home-grid">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <HomeSlot key={i} index={i} dragFrom={dragFrom} onDragFrom={setDragFrom} />
        ))}
        <WorkspaceContext />
      </WorkspaceGrid>
    </>
  )
}
