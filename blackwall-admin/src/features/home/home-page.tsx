import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUi } from "@/stores/ui"
import { useState } from "react"
import { SLOT_COUNT } from "@/lib/home-slots"
import { WorkspaceContext } from "./workspace-context"
import { HomeSlot } from "./home-slot"
import { PullRequestsPanel, RepositoriesPanel, ThisWeekPanel } from "./overview-panels"

/**
 * Home: the approved overview first (Pull requests 7/12 beside This week 5/12, Repositories
 * full width), then your chosen modules and workspace context. 24px between every panel;
 * panels are as tall as their content.
 */
export function HomePage() {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  return (
    <div className="@container/main mx-auto grid w-full max-w-[var(--bw-page-max)] gap-6 pb-6">
      <div className="grid grid-cols-1 items-start gap-6 @5xl/main:grid-cols-[7fr_5fr]">
        <PullRequestsPanel />
        <ThisWeekPanel />
      </div>
      <RepositoriesPanel />
      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-[11.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Your modules</h2>
        <Button variant="quiet" size="sm" onClick={() => useUi.getState().openSettings("dashboard")}><SlidersHorizontal /> Customize</Button>
      </div>
      <div className="grid grid-cols-1 gap-6 @2xl/main:grid-cols-2 @6xl/main:grid-cols-3" data-testid="home-grid">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <HomeSlot key={i} index={i} dragFrom={dragFrom} onDragFrom={setDragFrom} />
        ))}
        <WorkspaceContext />
      </div>
    </div>
  )
}
