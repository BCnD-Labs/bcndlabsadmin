import { Copy, ListTree, Plus, Trash2 } from "lucide-react"
import { memo, useMemo } from "react"
import { renderSectionPreview } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import type { Asset, Draft, Site, SiteBlock, SiteForm } from "@/lib/types"
import { blockName } from "./layers-pane"
import { PaneHead } from "./pages-pane"
import { ScaledFrame } from "./site-preview"
import { SortableTree } from "./sortable-tree"

/** What to call a section under its picture: its first heading, so two sections of the same kind can be told apart. */
function caption(block: SiteBlock): string {
  const first = (list: SiteBlock[]): string => { for (const b of list) { if (b.type === "heading" && String(b.text ?? "").trim()) return String(b.text); const below = b.kids ? first(b.kids) : ""; if (below) return below } return "" }
  return first(block.kids ?? []) || blockName(block, true)
}

type Parts = { site: Site; posts: Draft[]; forms: SiteForm[]; assets: Asset[]; pictures: Record<string, string> }

/** A section as it really looks. Only the one you changed redraws. */
const Thumb = memo(function Thumb({ block, site, posts, forms, assets, pictures }: Parts & { block: SiteBlock }) {
  const html = useMemo(() => renderSectionPreview(site, block, { posts, forms, assets, assetUrls: pictures }), [site, block, posts, forms, assets, pictures])
  return <ScaledFrame html={html} title={blockName(block, true)} width={1000} aspect={2.2} fit className="rounded-[5px]" />
})

/** The page as a stack of pictures of its sections: drag one to move it, click to go to it. */
export function SectionsPane({ sections, selectedId, onSelect, onMove, onRemove, onDuplicate, onAdd, onTree, onDragging, ...parts }: Parts & {
  sections: SiteBlock[]; selectedId: string | null
  onSelect: (id: string) => void; onMove: (id: string, beforeId: string | null) => void
  onRemove: (id: string) => void; onDuplicate: (id: string) => void; onAdd: () => void; onTree: () => void; onDragging: (on: boolean) => void
}) {
  const rows = useMemo(() => sections.map((block) => ({ id: block.id, depth: 0, parentId: null, block })), [sections])
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="sections-pane">
      <PaneHead title="Sections">
        <Button variant="quiet" size="icon-xs" aria-label="Detailed layers" title="Detailed layers" onClick={onTree}><ListTree /></Button>
        <Button variant="quiet" size="icon-xs" aria-label="Add a section" title="Add a section" onClick={onAdd}><Plus /></Button>
      </PaneHead>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {rows.length > 0 && (
          <SortableTree rows={rows} label="Sections of this page" selectedId={selectedId} onDragging={onDragging} gap="gap-2"
            canDrop={(_, parent) => parent === null}
            onMove={(id, _parent, beforeId) => onMove(id, beforeId)}
            onRowKey={(row, e) => { if (e.key === "Enter" && e.target === e.currentTarget) onSelect(row.id) }}
            render={({ id, block }) => (
              <div className="relative w-full cursor-grab py-1 pr-0.5 active:cursor-grabbing" data-section-thumb={id}>
                <button type="button" tabIndex={-1} onClick={() => onSelect(id)} aria-label={`Go to ${blockName(block, true)}`} className="block w-full text-left">
                  <Thumb block={block} {...parts} />
                  <span className="mt-1 block truncate text-[11.5px] text-ink-2">{caption(block)}</span>
                </button>
                <span className="absolute top-2 right-1.5 flex gap-0.5 rounded-[5px] bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="quiet" size="icon-xs" className="text-white hover:text-white" aria-label={`Duplicate ${blockName(block, true)}`} onClick={() => onDuplicate(id)}><Copy /></Button>
                  <Button variant="quiet" size="icon-xs" className="text-white hover:text-white" aria-label={`Remove ${blockName(block, true)}`} onClick={() => onRemove(id)}><Trash2 /></Button>
                </span>
              </div>
            )}
          />
        )}
        <button type="button" onClick={onAdd} className="mt-2 flex h-14 w-full items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-line text-xs text-muted-foreground transition-colors hover:border-[var(--bw-red)] hover:text-ink"><Plus className="size-3.5" /> Add a section</button>
      </div>
    </div>
  )
}
