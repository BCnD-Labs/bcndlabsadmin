import { ChevronDown, ChevronRight, GalleryVertical, Plus, Trash2 } from "lucide-react"
import { useMemo } from "react"
import { ADDABLE, BLOCKS, SECTIONS } from "@shared/sitebuilder"
import { canHold, type TreeRow } from "@shared/sitebuilder-tree"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { SiteBlock } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PaneHead } from "./pages-pane"
import { SortableTree } from "./sortable-tree"

type LayerRow = TreeRow & { block: SiteBlock }

function flatten(list: SiteBlock[], collapsed: Set<string>, depth = 0, parentId: string | null = null): LayerRow[] {
  return list.flatMap((block) => [{ id: block.id, depth, parentId, block }, ...(block.kids && !collapsed.has(block.id) ? flatten(block.kids, collapsed, depth + 1, block.id) : [])])
}

export const blockName = (b: SiteBlock, top: boolean) => (top && b.preset && SECTIONS[b.preset] ? SECTIONS[b.preset].name : BLOCKS[b.type]?.name ?? b.type)

/** Layers: the page's sections and blocks as a tree. Drag to reorder and to move in and out of rows and cards; Alt+arrows do the same from the keyboard. */
export function LayersPane({ sections, selectedId, collapsed, onToggle, onSelect, onMove, onRemove, onAdd, onAddSection, onDragging, onPictures }: {
  sections: SiteBlock[]; selectedId: string | null; collapsed: Set<string>
  onToggle: (id: string) => void; onSelect: (id: string) => void
  onMove: (id: string, parentId: string | null, beforeId: string | null) => void
  onRemove: (id: string) => void; onAdd: (parent: string, type: string) => void; onAddSection: () => void; onDragging: (on: boolean) => void; onPictures: () => void
}) {
  const rows = useMemo(() => flatten(sections, collapsed), [sections, collapsed])
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="layers-pane">
      <PaneHead title="Layers"><Button variant="quiet" size="icon-xs" aria-label="Show sections as pictures" title="Show sections as pictures" onClick={onPictures}><GalleryVertical /></Button><Button variant="quiet" size="xs" className="text-muted-foreground" onClick={onAddSection}><Plus /> Section</Button></PaneHead>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {rows.length ? (
          <SortableTree<LayerRow> rows={rows} label="Layers of this page" selectedId={selectedId} onDragging={onDragging}
            canDrop={(active, parent) => canHold(parent?.block ?? null, active.block)}
            onMove={onMove}
            onRowKey={(row, e) => { if (e.key === "Enter" && e.target === e.currentTarget) onSelect(row.id) }}
            render={({ id, block: b, depth }) => {
              const def = BLOCKS[b.type]
              const peek = String(b.text ?? b.md ?? b.items ?? b.alt ?? b.code ?? "").split("\n")[0].slice(0, 60)
              const folds = !!b.kids?.length
              return (
                <>
                  <button type="button" tabIndex={-1} aria-label={collapsed.has(id) ? "Open" : "Close"} onClick={() => onToggle(id)} className={cn("grid size-4 shrink-0 place-items-center text-faint", !folds && "invisible")}>{collapsed.has(id) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}</button>
                  <button type="button" tabIndex={-1} onClick={() => onSelect(id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left">
                    <span className={cn("shrink-0 text-[12.5px]", def?.container ? "font-semibold text-ink-2" : "text-ink")}>{blockName(b, depth === 0)}</span>
                    {peek && <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">{peek}</span>}
                  </button>
                  <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    {def?.container && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="quiet" size="icon-xs" aria-label={`Add a block to ${def.name}`}><Plus /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-80 w-52 overflow-y-auto">
                          <DropdownMenuLabel className="bw-label">Add to {def.name.toLowerCase()}</DropdownMenuLabel>
                          {ADDABLE.filter((t) => canHold(b, { type: t })).map((t) => <DropdownMenuItem key={t} onSelect={() => onAdd(id, t)}>{BLOCKS[t].name}</DropdownMenuItem>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button variant="quiet" size="icon-xs" aria-label={`Remove ${def?.name ?? "block"}`} onClick={() => onRemove(id)}><Trash2 /></Button>
                  </span>
                </>
              )
            }}
          />
        ) : (
          <div className="grid justify-items-center gap-2 px-2 py-5 text-center text-xs text-muted-foreground">
            <p>This page is empty. Add a section and fill it in.</p>
            <Button size="sm" onClick={onAddSection}><Plus /> Add a section</Button>
          </div>
        )}
      </div>
    </div>
  )
}
