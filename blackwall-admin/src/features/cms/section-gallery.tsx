import { useMemo } from "react"
import { SECTIONS, SECTION_ORDER, renderPage, section } from "@shared/sitebuilder"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { Draft, Site, SiteForm, SitePage } from "@/lib/types"

const STAMP = "2026-01-01T00:00:00.000Z"

/** "Add a section": every ready-made section shown as it will look on this site, so you pick by looking. */
export function SectionGallery({ open, onOpenChange, site, pages, posts, forms, onPick }: {
  open: boolean; onOpenChange: (open: boolean) => void; site: Site; pages: SitePage[]; posts: Draft[]; forms: SiteForm[]; onPick: (key: string | "empty") => void
}) {
  const previews = useMemo(() => open ? Object.fromEntries(SECTION_ORDER.map((k) => {
    const page: SitePage = { id: `gallery-${k}`, siteId: site.id, title: SECTIONS[k].name, slug: "gallery", description: "", inMenu: false, order: 0, sections: [section(k)], createdAt: STAMP, updatedAt: STAMP }
    return [k, renderPage(site, pages, page, { posts, forms })]
  })) : {}, [open, site, pages, posts, forms])
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
                <span className="pointer-events-none relative block h-32 overflow-hidden bg-white" aria-hidden>
                  <iframe title={SECTIONS[k].name} srcDoc={previews[k]} sandbox="" tabIndex={-1} className="absolute top-0 left-0 h-[640px] w-[1000px] origin-top-left border-0" style={{ transform: "scale(0.33)" }} />
                </span>
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

