import type { ComponentType } from "react"
import { Button } from "@/components/ui/button"
import { PANEL_TYPES, type PanelType } from "@/lib/home-slots"
import { usePrefs } from "@/stores/prefs"
import { CourseworkMeta, CourseworkPanel } from "./coursework-panel"
import { ProductivityMeta, ProductivityPanel } from "./productivity-panel"

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
  /** Header prompt: `❯ tool $ command`. */
  tool: string
  command: string
  /** Right-hand header text; a component so it can read stores. */
  Meta?: ComponentType
  Body: ComponentType<PanelBodyProps>
  bodyClassName?: string
}

/** An unassigned square: "[ EMPTY ]" and a picker. Deliberately unlike NoSignal (not connected). */
function EmptySlot({ slot }: PanelBodyProps) {
  const slots = usePrefs((s) => s.homeSlots)
  const setSlot = usePrefs((s) => s.setSlot)
  const options = PANEL_TYPES.filter((t) => t !== "empty")
  return (
    <div className="flex h-full p-3">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-ledge-hi px-4 py-6 text-center" data-testid="empty-slot">
        <p className="font-mono text-[11px] font-semibold tracking-[0.3em] text-faint">[ EMPTY ]</p>
        <p className="text-[11px] text-muted-foreground">Choose what this square shows.</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {options.map((t) => {
            const from = slots.indexOf(t)
            return (
              <Button key={t} variant="ghost" onClick={() => setSlot(slot, t)}>
                + {PANELS[t].label}
                {from >= 0 && <span className="text-faint">· from slot {from + 1}</span>}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const PANELS: Record<PanelType, PanelDef> = {
  productivity: { label: "Productivity", tool: "productivity", command: "today", Meta: ProductivityMeta, Body: ProductivityPanel },
  coursework: { label: "Coursework", tool: "learning", command: "upcoming", Meta: CourseworkMeta, Body: CourseworkPanel },
  empty: { label: "Empty", tool: "slot", command: "empty", Body: EmptySlot },
}
