import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { LIBRARY, LIBRARY_GROUPS, type LibraryItem } from "@shared/site-library"
import { mk, renderSectionPreview } from "@shared/sitebuilder"
import { Input } from "@/components/ui/input"
import { Panel } from "@/components/common/panel"
import type { Site } from "@/lib/types"
import { ScaledFrame } from "./site-preview"

/** The component library: everything you can add, shown in this site's own look. Click one to add it where you are on the page. */
export function ComponentsPanel({ site, hint, onInsert }: { site: Site; hint: string; onInsert: (item: LibraryItem) => void }) {
  const [q, setQ] = useState("")
  const words = q.trim().toLowerCase()
  const previews = useMemo(() => new Map(LIBRARY.map((i) => [i.id, renderSectionPreview(site, i.section ? i.make() : mk("section", {}, [i.make()]))])), [site])
  const shown = LIBRARY.filter((i) => !words || `${i.name} ${i.about} ${i.group}`.toLowerCase().includes(words))
  return (
    <div className="grid content-start gap-[var(--bw-grid-gap)]" data-testid="components-panel">
      <Panel category="website" title="Add a component" meta={hint} bodyClassName="grid gap-2 px-3.5 py-3">
        <label className="relative block"><Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" aria-hidden /><Input aria-label="Search components" className="h-8 pl-7 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: card, badge, calendar, quote…" /></label>
        <p className="text-[11px] text-faint">Click one to add it. It goes inside the block you have selected if it fits, after it if not, or at the end of the page.</p>
      </Panel>
      {LIBRARY_GROUPS.map((g) => {
        const items = shown.filter((i) => i.group === g)
        if (!items.length) return null
        return (
          <Panel key={g} category="website" title={g} meta={String(items.length)} bodyClassName="grid grid-cols-2 gap-2 p-2.5">
            {items.map((i) => (
              <button key={i.id} type="button" onClick={() => onInsert(i)} data-testid={`add-${i.id}`} className="group overflow-hidden rounded-[10px] bg-raised text-left ring-1 ring-line-soft transition hover:ring-2 hover:ring-[var(--bw-red)] focus-visible:ring-2 focus-visible:ring-[var(--bw-red)]" title={i.about}>
                <ScaledFrame html={previews.get(i.id) ?? ""} title={`${i.name} preview`} width={640} aspect={16 / 10} />
                <span className="block truncate px-2 pt-1.5 text-xs font-semibold text-ink">{i.name}</span>
                <span className="block truncate px-2 pb-1.5 text-[10.5px] text-muted-foreground">{i.about}</span>
              </button>
            ))}
          </Panel>
        )
      })}
      {!shown.length && <p className="px-1 text-xs text-muted-foreground">Nothing matches “{q}”.</p>}
    </div>
  )
}
