import type { Category } from "@/components/common/category-icon"
import { HomeTrafficPanel, TrafficMeta } from "./extra-panels"
import type { ComponentType } from "react"
import { Button } from "@/components/ui/button"
import { PANEL_TYPES, type PanelType } from "@/lib/home-slots"
import { usePrefs } from "@/stores/prefs"
import { CourseworkMeta, CourseworkPanel } from "./coursework-panel"
import { ProductivityMeta, ProductivityPanel } from "./productivity-panel"
import { CalendarMeta, DevelopmentMeta, HomeCalendarPanel, HomeDevelopmentPanel, HomeWebsitePanel, WebsiteMeta } from "./extra-panels"

export interface PanelBodyProps {
  /** Which Home square (0–3) the panel is in. */
  slot: number
}

/**
 * One entry per Home panel type. Adding a type = add its id to PANEL_TYPES
 * (lib/home-slots.ts) and an entry here.
 */
export interface PanelDef {
  label: string
  category?: Category
  /** Header prompt: `❯ tool $ command`. */
  tool: string
  command: string
  /** Right-hand header text; a component so it can read stores. */
  Meta?: ComponentType
  Body: ComponentType<PanelBodyProps>
  bodyClassName?: string
}

/** An unassigned square: "Choose a panel" and a picker. Deliberately unlike NoSignal (not connected). */
function EmptySlot({ slot }: PanelBodyProps) {
  const slots = usePrefs((s) => s.homeSlots)
  const setSlot = usePrefs((s) => s.setSlot)
  const options = PANEL_TYPES.filter((t) => t !== "empty")
  return (
    <div className="flex h-full p-3">
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[10px] border border-dashed border-ledge-hi px-4 py-5 text-center" data-testid="empty-slot">
        <p className="font-mono text-[11px] font-semibold tracking-[0.3em] text-faint">No panel selected</p>
        <p className="text-[11px] text-muted-foreground">Choose what to show in this position.</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {options.map((t) => {
            const from = slots.indexOf(t)
            return (
              <Button key={t} variant="ghost" size="sm" onClick={() => setSlot(slot, t)}>
                + {PANELS[t].label}
                {from >= 0 && <span className="text-faint">· moves from position {from + 1}</span>}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const PANELS: Record<PanelType, PanelDef> = {
  productivity: { label: "Tasks & notes", category: "tasks", tool: "productivity", command: "today", Meta: ProductivityMeta, Body: ProductivityPanel },
  coursework: { label: "Assignments & exams", category: "learning", tool: "learning", command: "upcoming", Meta: CourseworkMeta, Body: CourseworkPanel },
  calendar: { label: "Calendar & agenda", category: "calendar", tool: "calendar", command: "today", Meta: CalendarMeta, Body: HomeCalendarPanel },
  development: { label: "GitHub activity", category: "development", tool: "github", command: "status", Meta: DevelopmentMeta, Body: HomeDevelopmentPanel },
  website: { label: "Website content", category: "website", tool: "site", command: "posts", Meta: WebsiteMeta, Body: HomeWebsitePanel },
  analytics: { label: "Website traffic", category: "analytics", tool: "analytics", command: "traffic", Meta: TrafficMeta, Body: HomeTrafficPanel },
  empty: { label: "Hidden", tool: "slot", command: "empty", Body: EmptySlot },
}
