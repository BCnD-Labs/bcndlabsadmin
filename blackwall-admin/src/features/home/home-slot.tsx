import { GridItem } from "@/components/common/workspace-grid"
import { Check, ChevronDown } from "lucide-react"
import { useState, type DragEvent } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Panel } from "@/components/common/panel"
import { PANEL_TYPES, SLOT_COUNT, type PanelType } from "@/lib/home-slots"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { PANELS } from "./panel-registry"

const MIME = "application/x-blackwall-slot"

/** The slot's header dropdown: choose a panel type, or move the panel to another square. */
function SlotMenu({ index, type }: { index: number; type: PanelType }) {
  const slots = usePrefs((s) => s.homeSlots)
  const setSlot = usePrefs((s) => s.setSlot)
  const swap = usePrefs((s) => s.swapSlots)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Customize ${PANELS[type].label} panel`}
        title="Choose or move this panel"
        className="flex size-8 items-center justify-center rounded-[6px] text-ink-2 hover:bg-raised aria-expanded:bg-selected"
        // Don't start a header drag from the menu button.
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        <span className="sr-only">{PANELS[type].label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))] text-[13px]">
        <DropdownMenuLabel className="bw-label">Show</DropdownMenuLabel>
        {PANEL_TYPES.map((t) => {
          const at = slots.indexOf(t)
          return (
            <DropdownMenuItem key={t} onSelect={() => setSlot(index, t)} aria-checked={t === type} role="menuitemradio">
              <Check className={cn("size-3.5", t !== type && "invisible")} aria-hidden />
              <span className="min-w-0 whitespace-normal">{PANELS[t].label}{t !== "empty" && at >= 0 && at !== index && <span className="block text-[10px] text-faint">Moves from position {at + 1}</span>}</span>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="bw-label">Move</DropdownMenuLabel>
        {Array.from({ length: SLOT_COUNT }, (_, k) => (
          <DropdownMenuItem key={k} disabled={k === index} onSelect={() => swap(index, k)}>
            <span className="size-3.5" aria-hidden />
            Move to position {k + 1}
            {k === index && <span className="ml-auto text-[10px] text-faint">here</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * One Home square. Drag a panel by its header onto another square to swap them
 * (native drag-and-drop); the slot menu has the keyboard alternative.
 */
export function HomeSlot({
  index,
  dragFrom,
  onDragFrom,
}: {
  index: number
  /** The slot currently being dragged, if any. */
  dragFrom: number | null
  onDragFrom: (i: number | null) => void
}) {
  const type = usePrefs((s) => s.homeSlots[index])
  const swap = usePrefs((s) => s.swapSlots)
  const [over, setOver] = useState(false)
  const def = PANELS[type]
  const { Body, Meta } = def
  const target = dragFrom !== null && dragFrom !== index

  if (type === "empty") return null

  const accepts = (e: DragEvent) => target && e.dataTransfer.types.includes(MIME)

  return (
    <GridItem span={type === "productivity" || type === "website" || type === "calendar" || type === "analytics" ? 2 : 1} rows={1}
      className={cn("relative flex min-w-0 flex-col", dragFrom === index && "opacity-50")}
      data-testid={`slot-${index + 1}`}
      data-type={type}
      onDragOver={(e) => {
        if (!accepts(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
      }}
      onDragEnter={(e) => accepts(e) && setOver(true)}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        setOver(false)
        if (!accepts(e)) return
        e.preventDefault()
        const from = Number(e.dataTransfer.getData(MIME))
        if (Number.isInteger(from) && from !== index) swap(from, index)
        onDragFrom(null)
      }}
    >
      <Panel
        tool={def.tool}
        command={def.command}
        title={def.label}
        category={def.category}
        meta={Meta && <Meta />}
        label={`Slot ${index + 1}: ${def.label}`}
        actions={<SlotMenu index={index} type={type} />}
        className="flex-1"
        bodyClassName={cn("@container flex flex-col overflow-y-auto", def.bodyClassName)}
        headerProps={{
          draggable: true,
          title: "Drag onto another square to swap",
          className: "cursor-grab active:cursor-grabbing select-none",
          onDragStart: (e) => {
            e.dataTransfer.setData(MIME, String(index))
            e.dataTransfer.effectAllowed = "move"
            onDragFrom(index)
          },
          onDragEnd: () => onDragFrom(null),
        }}
      >
        <Body slot={index} />
      </Panel>
      {target && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center rounded-[12px] outline-2 -outline-offset-2 outline-dashed transition-colors duration-150",
            over ? "bg-ink-2/5 outline-ink-2" : "outline-ledge-hi",
          )}
          data-testid={over ? "drop-target" : undefined}
        >
          {over && (
            <span className="rounded-[6px] border border-border bg-raised px-2.5 py-1 text-xs text-ink shadow-sm">
              ⇅ swap with slot {dragFrom! + 1}
            </span>
          )}
        </div>
      )}
    </GridItem>
  )
}
