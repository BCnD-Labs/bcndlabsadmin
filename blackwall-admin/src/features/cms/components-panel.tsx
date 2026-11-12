import { ChevronDown, ChevronRight, LayoutGrid, List, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { LIBRARY, LIBRARY_GROUPS, type LibraryItem } from "@shared/site-library"
import { mk, renderSectionPreview } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Site } from "@/lib/types"
import { cn } from "@/lib/utils"
import { safeLocalStorage } from "@/stores/storage"
import { ScaledFrame } from "./site-preview"

const KEY = "blackwall.components-panel"
interface Saved { view: "tiles" | "list"; open: string[] }
const DEFAULTS: Saved = { view: "tiles", open: ["Cards and layout"] }
/** What you chose last time (per browser): tiles or a plain list, and which groups are open. */
function load(): Saved {
  try {
    const v = JSON.parse((safeLocalStorage.getItem(KEY) as string | null) ?? "null")
    return { view: v?.view === "list" ? "list" : "tiles", open: Array.isArray(v?.open) ? v.open.filter((g: unknown): g is string => typeof g === "string") : DEFAULTS.open }
  } catch { return DEFAULTS }
}

/** A small thing (a badge, a button) is shown on a short strip with no page padding around it. */
const previewOf = (site: Site, i: LibraryItem) => {
  const block = i.make()
  return renderSectionPreview(site, i.section ? block : { ...mk("section", {}, [block]), design: i.size ? { top: "s" as const, bottom: "s" as const } : undefined })
}

/** The component library: everything you can add. Groups fold away, small things get small tiles, and a plain list is one click off. */
export function ComponentsPanel({ site, hint, onInsert }: { site: Site; hint: string; onInsert: (item: LibraryItem) => void }) {
  const [saved, setSaved] = useState<Saved>(load)
  const [q, setQ] = useState("")
  const words = q.trim().toLowerCase()
  const save = (next: Saved) => { setSaved(next); try { safeLocalStorage.setItem(KEY, JSON.stringify(next)) } catch { /* the choice just isn't remembered */ } }
  const isOpen = (g: string) => !!words || saved.open.includes(g)
  const toggle = (g: string) => save({ ...saved, open: saved.open.includes(g) ? saved.open.filter((x) => x !== g) : [...saved.open, g] })
  const shown = LIBRARY.filter((i) => !words || `${i.name} ${i.about} ${i.group}`.toLowerCase().includes(words))
  const groups = LIBRARY_GROUPS.map((g) => ({ name: g, items: shown.filter((i) => i.group === g) })).filter((g) => g.items.length)
  const allOpen = groups.every((g) => isOpen(g.name))
  // Pictures of the items are only made for groups that are open, and only in tile view.
  const previews = useMemo(() => {
    const m = new Map<string, string>()
    if (saved.view === "tiles") for (const g of groups) if (isOpen(g.name)) for (const i of g.items) m.set(i.id, previewOf(site, i))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the groups follow from `words` and `saved`
  }, [site, saved, words])

  return (
    <div className="grid content-start gap-2" data-testid="components-panel">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1.5">
          <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" aria-hidden /><Input aria-label="Search components" className="h-8 pl-7 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: card, badge, calendar, quote…" /></label>
          <div role="group" aria-label="How to show them" className="flex shrink-0 rounded-[8px] bg-raised p-0.5">
            <Button type="button" variant={saved.view === "tiles" ? "secondary" : "quiet"} size="icon-xs" aria-pressed={saved.view === "tiles"} aria-label="Show as tiles" title="Tiles" onClick={() => save({ ...saved, view: "tiles" })}><LayoutGrid /></Button>
            <Button type="button" variant={saved.view === "list" ? "secondary" : "quiet"} size="icon-xs" aria-pressed={saved.view === "list"} aria-label="Show as a list" title="List" onClick={() => save({ ...saved, view: "list" })}><List /></Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <span className="min-w-0 flex-1 truncate">Adds {hint}.</span>
          {!words && <Button type="button" variant="quiet" size="xs" onClick={() => save({ ...saved, open: allOpen ? [] : [...LIBRARY_GROUPS] })}>{allOpen ? "Collapse all" : "Expand all"}</Button>}
        </div>
      </div>
      {groups.map((g) => {
        const open = isOpen(g.name)
        return (
          <section key={g.name} className="overflow-hidden rounded-[10px] ring-1 ring-line-soft" data-testid={`group-${g.name}`}>
            <h3 className="m-0">
              <button type="button" aria-expanded={open} onClick={() => !words && toggle(g.name)} className="flex h-8 w-full items-center gap-1.5 bg-raised px-2 text-left text-[12.5px] font-semibold text-ink transition-colors hover:bg-selected">
                {open ? <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                <span className="text-[11px] font-normal text-muted-foreground tabular-nums">{g.items.length}</span>
              </button>
            </h3>
            {open && (saved.view === "list" ? (
              <ul className="divide-y divide-line-soft">
                {g.items.map((i) => (
                  <li key={i.id}><button type="button" onClick={() => onInsert(i)} data-testid={`add-${i.id}`} className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-selected focus-visible:bg-selected"><b className="shrink-0 text-xs text-ink">{i.name}</b><span className="min-w-0 truncate text-[11px] text-muted-foreground">{i.about}</span></button></li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-6 gap-1.5 p-1.5">
                {g.items.map((i) => (
                  <button key={i.id} type="button" onClick={() => onInsert(i)} data-testid={`add-${i.id}`} title={i.about} className={cn("group overflow-hidden rounded-[8px] bg-raised text-left ring-1 ring-line-soft transition hover:ring-2 hover:ring-[var(--bw-red)] focus-visible:ring-2 focus-visible:ring-[var(--bw-red)]", i.size ? "col-span-2" : "col-span-3")}>
                    <ScaledFrame html={previews.get(i.id) ?? ""} title={`${i.name} preview`} width={i.size ? 520 : 640} aspect={i.size ? 16 / 7 : 16 / 10} fit={!!i.size} />
                    <span className="block truncate px-1.5 pt-1 text-[11.5px] font-semibold text-ink">{i.name}</span>
                    {!i.size && <span className="block truncate px-1.5 pb-1 text-[10.5px] text-muted-foreground">{i.about}</span>}
                    {i.size && <span className="block pb-1" />}
                  </button>
                ))}
              </div>
            ))}
          </section>
        )
      })}
      {!groups.length && <p className="px-1 text-xs text-muted-foreground">Nothing matches “{q}”.</p>}
    </div>
  )
}
