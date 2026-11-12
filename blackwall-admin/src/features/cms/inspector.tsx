import { Copy, Plus, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BLOCKS, footerPages, type BlockField } from "@shared/sitebuilder"
import { ANIMATIONS } from "@shared/site-bootstrap"
import { canNest, pageTree } from "@shared/sitebuilder-tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { OptionSelect } from "@/components/forms/fields"
import { AssetField } from "@/features/assets/asset-field"
import { cmsPagesHref, sitePageHref } from "@/lib/routes"
import type { BlockDesign, Site, SiteBlock, SitePage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { slugify } from "./cms-forms"
import { StateChip, pageState } from "./publish-bar"
import { RecordTasks } from "./page-links"
import { placePage } from "./pages-pane"
import { duplicatePage } from "./use-cms"

const fieldLabel = "text-[11.5px] font-normal text-muted-foreground"

function FieldInput({ f, value, onChange, onPatch, block, id }: { f: BlockField; value: unknown; onChange: (v: unknown) => void; onPatch: (p: Record<string, unknown>) => void; block: SiteBlock; id: string }) {
  const forms = useWorkspace((s) => s.forms)
  const openForm = useUi((s) => s.openForm)
  const v = value == null ? "" : String(value)
  if (f.kind === "asset") return <AssetField id={id} value={v} onPick={(a) => onPatch({ [f.k]: `/images/${a.file}`, ...(String(block.alt ?? "").trim() ? {} : { alt: a.alt }) })} onClear={() => onChange("")} />
  if (f.kind === "big") return <Textarea id={id} rows={f.k === "md" || f.k === "code" ? 8 : 4} value={v} onChange={(e) => onChange(e.target.value)} className="font-[inherit] text-[13px]" />
  if (f.kind === "select") return <OptionSelect id={id} value={v || f.options![0].value} onChange={onChange} options={f.options!} className="w-full" />
  if (f.kind === "number") return <Input id={id} inputMode="numeric" value={v} onChange={(e) => onChange(Number(e.target.value) || "")} className="h-8 w-24" />
  if (f.kind === "form") {
    return (
      <div className="flex gap-2">
        <OptionSelect id={id} value={v || "none"} onChange={(x) => onChange(x === "none" ? "" : x)} options={[{ value: "none", label: forms.length ? "Choose a form…" : "No forms yet" }, ...forms.map((x) => ({ value: x.id, label: x.name }))]} className="min-w-0 flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={() => openForm({ kind: "siteForm" })}><Plus /> New</Button>
      </div>
    )
  }
  return <Input id={id} value={v} onChange={(e) => onChange(e.target.value)} className={cn("h-8", f.kind === "url" && "font-mono text-xs")} placeholder={f.kind === "url" ? "/contact/ or https://…" : undefined} />
}

const AUTO = "auto"
const SPACE = [{ value: AUTO, label: "Auto" }, { value: "none", label: "None" }, { value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }]

/** Style: one block's alignment, spacing and background. A block with nothing set renders exactly as it always did. */
function StyleFields({ block, onPatch }: { block: SiteBlock; onPatch: (p: Record<string, unknown>) => void }) {
  const d = block.design ?? {}
  const set = (patch: Partial<BlockDesign>) => {
    const next = Object.fromEntries(Object.entries({ ...d, ...patch }).filter(([, v]) => v !== undefined)) as BlockDesign
    onPatch({ design: Object.keys(next).length ? next : undefined })
  }
  const isSection = block.type === "section"
  const bg = d.bg ?? (isSection && block.tone === "tinted" ? "surface" : AUTO)
  // A section already has a background field; shaded keeps using it so it reads the same in older pages.
  const setBg = (v: string) => {
    const nextBg = v === "accent" || (v === "surface" && !isSection) ? (v as BlockDesign["bg"]) : undefined
    const rest = Object.fromEntries(Object.entries({ ...d, bg: nextBg }).filter(([, x]) => x !== undefined)) as BlockDesign
    onPatch({ design: Object.keys(rest).length ? rest : undefined, ...(isSection ? { tone: v === "surface" ? "tinted" : "page" } : {}) })
  }
  const row = (label: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void) => (
    <div className="grid gap-1"><span className={fieldLabel}>{label}</span><SegmentedTabs label={label} value={value} onChange={onChange} tabs={options} tabClassName="flex-1 px-1.5" /></div>
  )
  return (
    <div className="grid gap-3">
      {row("Alignment", d.align ?? AUTO, [{ value: AUTO, label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }], (v) => set({ align: v === AUTO ? undefined : (v as BlockDesign["align"]) }))}
      {row("Space above", d.top ?? AUTO, SPACE, (v) => set({ top: v === AUTO ? undefined : (v as BlockDesign["top"]) }))}
      {row("Space below", d.bottom ?? AUTO, SPACE, (v) => set({ bottom: v === AUTO ? undefined : (v as BlockDesign["bottom"]) }))}
      {row("Background", bg, [{ value: AUTO, label: "None" }, { value: "surface", label: "Shaded" }, { value: "accent", label: "Accent" }], setBg)}
      <div className="grid gap-1"><span className={fieldLabel}>Animation</span>
        <OptionSelect id="style-anim" value={d.anim ?? AUTO} onChange={(v) => set({ anim: v === AUTO ? undefined : (v as BlockDesign["anim"]) })} options={[{ value: AUTO, label: "None" }, ...Object.entries(ANIMATIONS).map(([value, a]) => ({ value, label: a.name }))]} className="w-full" />
        <span className="text-[11px] text-faint">Plays when the page loads; skipped for visitors who ask for less motion.</span>
      </div>
    </div>
  )
}

/** With nothing selected: this page's title, address, description and where it shows in the menus. */
function PageFields({ site, page, pages }: { site: Site; page: SitePage; pages: SitePage[] }) {
  const { update, remove } = useWorkspace.getState()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const slugAtFocus = useRef<string | null>(null)
  const set = (patch: Partial<SitePage>) => update("pages", page.id, patch)
  const wasPublished = !!site.publishedAt && page.createdAt <= site.publishedAt
  const commitSlug = () => {
    const before = slugAtFocus.current
    slugAtFocus.current = null
    if (before == null || before === page.slug || !wasPublished || !before) return
    // A published page moved: the old address forwards to the new one.
    const redirects = [...site.redirects.filter((r) => r.from.replace(/^\/|\/$/g, "") !== page.slug && r.from.replace(/^\/|\/$/g, "") !== before), { from: `/${before}`, to: `/${page.slug}/` }]
    update("sites", site.id, { redirects })
    toast.success(`/${before} will redirect to /${page.slug}`)
  }
  const clash = pages.some((p) => p.id !== page.id && p.slug === page.slug)
  const isHome = !page.slug
  const inFooter = footerPages(pages).some((p) => p.id === page.id)
  const setFooter = (on: boolean) => {
    // The first pick turns the footer into its own menu; it starts as what it was showing.
    if (!pages.some((p) => p.inFooter != null)) for (const p of pages) update("pages", p.id, { inFooter: p.id === page.id ? on : p.inMenu })
    else set({ inFooter: on })
  }
  const del = () => {
    const copy = page
    remove("pages", page.id)
    navigate(cmsPagesHref)
    toast(`${copy.title} deleted`, { description: "It leaves the site when you next get the files.", action: { label: "Undo", onClick: () => useWorkspace.setState((st) => ({ pages: [copy, ...st.pages] })) } })
  }
  const parents = pageTree(pages).map((r) => r.page).filter((p) => p.id !== page.id)
  return (
    <div className="grid gap-3 p-3" data-testid="page-settings">
      <div className="flex items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">Page settings</h2><StateChip state={pageState(page, site)} /></div>
      <div className="grid gap-1"><Label htmlFor="pg-title" className={fieldLabel}>Title</Label><Input id="pg-title" className="h-8" value={page.title} onChange={(e) => set({ title: e.target.value })} /></div>
      <div className="grid gap-1">
        <Label htmlFor="pg-slug" className={fieldLabel}>Address</Label>
        <div className="flex items-center gap-1"><span className="text-muted-foreground">/</span>
          <Input id="pg-slug" className="h-8 font-mono text-xs" disabled={isHome} value={page.slug} placeholder="home" aria-invalid={clash} onFocus={() => (slugAtFocus.current = page.slug)} onBlur={commitSlug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
        </div>
        {isHome ? <span className="text-[11px] text-faint">The home page has no address.</span> : clash && <span className="text-[11px] text-red-text">Another page uses this address.</span>}
      </div>
      <div className="grid gap-1"><Label htmlFor="pg-desc" className={fieldLabel}>Description (search and share text)</Label><Textarea id="pg-desc" rows={2} className="text-[13px]" value={page.description} onChange={(e) => set({ description: e.target.value })} placeholder="One sentence about this page" /></div>
      <div className="flex items-center gap-2"><Switch id="pg-menu" checked={page.inMenu} onCheckedChange={(inMenu) => set({ inMenu })} /><Label htmlFor="pg-menu" className="text-xs font-normal">In the site menu</Label></div>
      <div className="flex items-center gap-2"><Switch id="pg-footer" checked={inFooter} onCheckedChange={setFooter} /><Label htmlFor="pg-footer" className="text-xs font-normal">In the footer menu</Label></div>
      {canNest(page, pages) && parents.length > 0 && (
        <div className="grid gap-1"><Label htmlFor="pg-parent" className={fieldLabel}>Drop-down under</Label>
          <OptionSelect id="pg-parent" value={page.parentId ?? "none"} onChange={(v) => placePage(pages, page.id, v === "none" ? null : v, null)} options={[{ value: "none", label: "Nothing (top level)" }, ...parents.map((p) => ({ value: p.id, label: p.title || "Untitled" }))]} className="w-full" />
        </div>
      )}
      <div className="grid gap-1.5 border-t border-line-soft pt-3"><h3 className={fieldLabel}>Linked tasks</h3><RecordTasks kind="page" id={page.id} name={page.title} /></div>
      <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
        <Button size="xs" variant="outline" onClick={() => { const c = duplicatePage(page); toast.success(`Duplicated as ${c.title}`); navigate(sitePageHref(c.id)) }}><Copy /> Duplicate page</Button>
        {!isHome && !confirmDelete && <Button size="xs" variant="outline" className="text-red-text" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete page…</Button>}
      </div>
      {confirmDelete && (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] bg-red/10 px-3 py-2 text-xs text-ink-2" role="alert">
          <span className="min-w-0 flex-1">Delete “{page.title}”? It stays on your live site until you get the files again.</span>
          <Button size="xs" variant="outline" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button size="xs" className="bg-red text-white hover:bg-red/90" onClick={del}>Delete</Button>
        </div>
      )}
    </div>
  )
}

/** The right pane when no panel is open: the selected block's Content, Style and Links, or the page's settings. */
export function Inspector({ site, page, pages, block, blockTitle, trail, onPatch, onDuplicate, onRemove }: {
  site: Site; page: SitePage | undefined; pages: SitePage[]; block: SiteBlock | undefined; blockTitle: string; trail: string
  onPatch: (patch: Record<string, unknown>) => void; onDuplicate: () => void; onRemove: () => void
}) {
  // The tab stays put as you click from block to block, so styling several in a row stays on Style.
  const [tab, setTab] = useState("content")
  if (!page) return <p className="p-4 text-xs text-muted-foreground">Add a page to start.</p>
  if (!block) return <div className="h-full overflow-y-auto"><PageFields key={page.id} site={site} page={page} pages={pages} /></div>
  const def = BLOCKS[block.type]
  const fields = (def?.edit ?? []).filter((f) => !(block.type === "section" && f.k === "tone"))
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col gap-0" data-testid="inspector">
      <div className="grid shrink-0 gap-1.5 border-b border-line-soft p-2.5">
        <div className="flex items-center gap-1">
          <span className="min-w-0 flex-1"><b className="block truncate text-[13px] text-ink">{blockTitle}</b>{trail && <span className="block truncate text-[11px] text-faint">{trail}</span>}</span>
          <Button variant="quiet" size="icon-xs" aria-label="Duplicate this block" title="Duplicate (⌘D)" onClick={onDuplicate}><Copy /></Button>
          <Button variant="quiet" size="icon-xs" aria-label="Remove this block" title="Remove (Delete)" onClick={onRemove}><Trash2 /></Button>
        </div>
        <TabsList className="w-full"><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="style">Style</TabsTrigger><TabsTrigger value="links">Links</TabsTrigger></TabsList>
      </div>
      <TabsContent value="content" className="min-h-0 flex-1 overflow-y-auto p-3">
        {fields.length ? (
          <div className="grid gap-2.5">
            {fields.map((f) => (
              <div key={f.k} className="grid gap-1">
                <Label htmlFor={`${block.id}-${f.k}`} className={fieldLabel}>{f.l}</Label>
                <FieldInput id={`${block.id}-${f.k}`} f={f} block={block} value={block[f.k]} onChange={(v) => onPatch({ [f.k]: v })} onPatch={onPatch} />
                {f.note && <span className="text-[11px] text-faint">{f.note}</span>}
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">Nothing to fill in here. Pick a block inside it, or use Style.</p>}
      </TabsContent>
      <TabsContent value="style" className="min-h-0 flex-1 overflow-y-auto p-3"><StyleFields block={block} onPatch={onPatch} /></TabsContent>
      <TabsContent value="links" className="min-h-0 flex-1 overflow-y-auto p-3"><RecordTasks kind="page" id={page.id} name={page.title} /></TabsContent>
    </Tabs>
  )
}
