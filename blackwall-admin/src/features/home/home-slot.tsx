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
        aria-label={`Slot ${index + 1}: choose what to show`}
        className="bw-well flex h-[26px] min-w-[118px] items-center justify-between gap-2 rounded-[6px] px-1.5 font-mono text-[11px] text-ink-2 hover:border-ledge-hi aria-expanded:border-ledge-hi"
        // Don't start a header drag from the menu button.
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        {PANELS[type].label}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 font-mono text-xs">
        <DropdownMenuLabel className="eyebrow">Show</DropdownMenuLabel>
        {PANEL_TYPES.map((t) => {
          const at = slots.indexOf(t)
          return (
            <DropdownMenuItem key={t} onSelect={() => setSlot(index, t)} aria-checked={t === type} role="menuitemradio">
              <Check className={cn("size-3.5", t !== type && "invisible")} aria-hidden />
              {PANELS[t].label}
              {t !== "empty" && at >= 0 && at !== index && <span className="ml-auto text-[10px] text-faint">swap w/ {at + 1}</span>}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="eyebrow">Move</DropdownMenuLabel>
        {Array.from({ length: SLOT_COUNT }, (_, k) => (
          <DropdownMenuItem key={k} disabled={k === index} onSelect={() => swap(index, k)}>
            <span className="size-3.5" aria-hidden />
            Move to slot {k + 1}
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

  const accepts = (e: DragEvent) => target && e.dataTransfer.types.includes(MIME)

  return (
    <div
      className={cn("relative flex min-h-[340px] min-w-0 flex-col", dragFrom === index && "opacity-50")}
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
        meta={Meta && <Meta />}
        label={`Slot ${index + 1}: ${def.label}`}
        actions={<SlotMenu index={index} type={type} />}
        className="flex-1"
        bodyClassName={cn("flex flex-col", def.bodyClassName)}
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
            over ? "bg-[rgba(201,205,211,0.06)] outline-ink-2" : "outline-[#3A3D43]",
          )}
          data-testid={over ? "drop-target" : undefined}
        >
          {over && (
            <span className="rounded-[6px] border-r-2 border-b-2 border-ledge-hi bg-raised px-2.5 py-1 font-mono text-[11px] text-ink">
              ⇅ swap with slot {dragFrom! + 1}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
