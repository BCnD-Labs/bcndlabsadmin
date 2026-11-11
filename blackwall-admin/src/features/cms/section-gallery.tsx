import { useMemo } from "react"
import { SECTIONS, SECTION_ORDER, renderSectionPreview, section } from "@shared/sitebuilder"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { Draft, Site, SiteForm } from "@/lib/types"
import { ScaledFrame } from "./site-preview"

/** "Add a section": every ready-made section shown as it will look on this site, so you pick by looking. */
export function SectionGallery({ open, onOpenChange, site, posts, forms, onPick }: {
  open: boolean; onOpenChange: (open: boolean) => void; site: Site; posts: Draft[]; forms: SiteForm[]; onPick: (key: string | "empty") => void
}) {
  const previews = useMemo(() => open ? Object.fromEntries(SECTION_ORDER.map((k) => [k, renderSectionPreview(site, section(k), { posts, forms })])) : {}, [open, site, posts, forms])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl" aria-describedby="gallery-about">
        <div className="border-b border-line py-3 pr-12 pl-4">
          <DialogTitle className="font-heading text-base font-bold">Add a section</DialogTitle>
          <DialogDescription id="gallery-about" className="text-xs text-muted-foreground">Pick one that looks close. You can change every word and picture afterwards.</DialogDescription>
        </div>
        <ul className="grid max-h-[70dvh] gap-3 overflow-y-auto p-4 sm:grid-cols-2" aria-label="Sections">
          {SECTION_ORDER.map((k) => (
            <li key={k}>
              <button type="button" onClick={() => onPick(k)} className="group flex w-full flex-col overflow-hidden rounded-[10px] bg-raised text-left ring-1 ring-line-soft transition hover:ring-2 hover:ring-[var(--bw-red)]" aria-label={`Add ${SECTIONS[k].name}`}>
                {open && <ScaledFrame html={previews[k]} title={SECTIONS[k].name} aspect={16 / 9} />}
                <span className="px-3 py-2"><span className="block text-[13px] font-semibold text-ink">{SECTIONS[k].name}</span><span className="block text-[11.5px] text-muted-foreground">{SECTIONS[k].about}</span></span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => onPick("empty")} className="flex h-full min-h-24 w-full flex-col items-start justify-center rounded-[10px] bg-raised px-3 py-2 text-left ring-1 ring-line-soft hover:ring-2 hover:ring-[var(--bw-red)]">
              <span className="text-[13px] font-semibold text-ink">Empty section</span><span className="text-[11.5px] text-muted-foreground">Start from nothing and add your own blocks.</span>
            </button>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}

