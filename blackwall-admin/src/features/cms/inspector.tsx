import { ArrowLeftRight, Copy, Plus, Replace, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BLOCKS, blockClass, cleanAnchor, cleanClasses, cleanDeclarations, footerPages, type BlockField } from "@shared/sitebuilder"
import { ANIMATIONS } from "@shared/site-bootstrap"
import { canNest, pageTree } from "@shared/sitebuilder-tree"
import { HEADER_KINDS, type ConvertTarget } from "@shared/site-convert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
function StyleFields({ block, onPatch, inRow }: { block: SiteBlock; onPatch: (p: Record<string, unknown>) => void; inRow: boolean }) {
  const d = block.design ?? {}
  const set = (patch: Partial<BlockDesign>) => {
    const next = Object.fromEntries(Object.entries({ ...d, ...patch }).filter(([, v]) => v !== undefined)) as BlockDesign
    onPatch({ design: Object.keys(next).length ? next : undefined })
  }
  const isSection = block.type === "section"
  const bg = d.bg ?? (isSection && block.tone === "tinted" ? "surface" : AUTO)
  // A section already has a background field; shaded keeps using it so it reads the same in older pages.
  const setBg = (v: string) => {
    const nextBg = ["accent", "soft", "inverse"].includes(v) || (v === "surface" && !isSection) ? (v as BlockDesign["bg"]) : undefined
    const rest = Object.fromEntries(Object.entries({ ...d, bg: nextBg }).filter(([, x]) => x !== undefined)) as BlockDesign
    onPatch({ design: Object.keys(rest).length ? rest : undefined, ...(isSection ? { tone: v === "surface" ? "tinted" : "page" } : {}) })
  }
  const row = (label: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void) => (
    <div className="grid gap-1"><span className={fieldLabel}>{label}</span><SegmentedTabs label={label} value={value} onChange={onChange} tabs={options} tabClassName="flex-1 px-1.5" /></div>
  )
  const opt = <K extends keyof BlockDesign>(key: K) => (v: string) => set({ [key]: v === AUTO ? undefined : v } as Partial<BlockDesign>)
  return (
    <div className="grid gap-3">
      <h3 className="text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">Text</h3>
      {row("Size", d.size ?? AUTO, [{ value: AUTO, label: "Auto" }, { value: "s", label: "S" }, { value: "l", label: "L" }, { value: "xl", label: "XL" }], opt("size"))}
      {row("Colour", d.color ?? AUTO, [{ value: AUTO, label: "Auto" }, { value: "accent", label: "Accent" }, { value: "muted", label: "Quiet" }], opt("color"))}
      {row("Look", d.caps ?? AUTO, [{ value: AUTO, label: "Normal" }, { value: "on", label: "Small caps label" }], opt("caps"))}
      <h3 className="mt-1 text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">Layout</h3>
      {inRow && row("Width in the row", String(d.span ?? AUTO), [{ value: AUTO, label: "Auto" }, { value: "3", label: "¼" }, { value: "4", label: "⅓" }, { value: "6", label: "½" }, { value: "8", label: "⅔" }, { value: "9", label: "¾" }, { value: "12", label: "Full" }], (v) => set({ span: v === AUTO ? undefined : Number(v) }))}
      {row("Alignment", d.align ?? AUTO, [{ value: AUTO, label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }], (v) => set({ align: v === AUTO ? undefined : (v as BlockDesign["align"]) }))}
      {row("Space above", d.top ?? AUTO, SPACE, (v) => set({ top: v === AUTO ? undefined : (v as BlockDesign["top"]) }))}
      {row("Space below", d.bottom ?? AUTO, SPACE, (v) => set({ bottom: v === AUTO ? undefined : (v as BlockDesign["bottom"]) }))}
      {row(block.type === "section" ? "Content width" : "Width", d.width ?? AUTO, [{ value: AUTO, label: "Auto" }, { value: "medium", label: "Medium" }, { value: "narrow", label: "Narrow" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full" }], opt("width"))}
      {row("Height", d.minh ?? AUTO, [{ value: AUTO, label: "Auto" }, { value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }, { value: "screen", label: "Screen" }], opt("minh"))}
      {row("Show on", d.show ?? AUTO, [{ value: AUTO, label: "Everywhere" }, { value: "desktop", label: "Desktop only" }, { value: "phone", label: "Phone only" }], opt("show"))}
      {!isSection && row("Padding inside", d.pad ?? AUTO, [{ value: AUTO, label: "Auto" }, { value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }], opt("pad"))}
      <h3 className="mt-1 text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">Box</h3>
      {row("Background", bg, [{ value: AUTO, label: "None" }, { value: "surface", label: "Shaded" }, { value: "soft", label: "Soft" }, { value: "accent", label: "Accent" }, { value: "inverse", label: "Dark" }], setBg)}
      {row("Corners", d.radius ?? AUTO, [{ value: AUTO, label: "Auto" }, { value: "none", label: "Square" }, { value: "round", label: "Round" }, { value: "pill", label: "Pill" }], opt("radius"))}
      {row("Shadow", d.shadow ?? AUTO, [{ value: AUTO, label: "None" }, { value: "s", label: "Soft" }, { value: "m", label: "Strong" }], opt("shadow"))}
      {row("Outline", d.border ?? AUTO, [{ value: AUTO, label: "None" }, { value: "on", label: "Thin line" }], opt("border"))}
      <h3 className="mt-1 text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">Motion</h3>
      <div className="grid gap-1"><span className={fieldLabel}>Animation</span>
        <OptionSelect id="style-anim" value={d.anim ?? AUTO} onChange={(v) => set({ anim: v === AUTO ? undefined : (v as BlockDesign["anim"]) })} options={[{ value: AUTO, label: "None" }, ...Object.entries(ANIMATIONS).map(([value, a]) => ({ value, label: a.name }))]} className="w-full" />
        <span className="text-[11px] text-faint">Plays when the page loads; skipped for visitors who ask for less motion.</span>
      </div>
    </div>
  )
}

/** Extra pieces in the header beside the menu, on every page. Click one in the preview to edit or change it. */
export function HeaderItems({ items, onAdd, onSelect }: { items: SiteBlock[]; onAdd: (type: string) => void; onSelect: (id: string) => void }) {
  return (
    <div className="grid gap-1.5" data-testid="header-items">
      <h3 className={fieldLabel}>Header items</h3>
      <p className="text-[11px] text-faint">Extra pieces beside the menu on every page: a button, a badge, a dropdown. Click one in the preview to edit it or change it to something else.</p>
      {items.map((b) => (
        <button key={b.id} type="button" onClick={() => onSelect(b.id)} className="flex items-center gap-2 rounded-[8px] bg-raised px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-selected">
          <b className="text-ink">{BLOCKS[b.type]?.name ?? b.type}</b><span className="min-w-0 flex-1 truncate text-muted-foreground">{String(b.text ?? b.label ?? b.month ?? "")}</span>
        </button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="xs" variant="outline" className="justify-self-start"><Plus /> Add to header</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">{HEADER_KINDS.map((t) => <DropdownMenuItem key={t} onSelect={() => onAdd(t)}>{BLOCKS[t].name}</DropdownMenuItem>)}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** "Change to…": the other kinds this block can become, keeping its words, link and style. */
function ChangeMenu({ targets, open, onOpenChange, onConvert }: { targets: ConvertTarget[]; open: boolean; onOpenChange: (o: boolean) => void; onConvert: (type: string) => void }) {
  if (!targets.length) return null
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild><Button variant="outline" size="xs" data-testid="change-to" aria-label="Change to another component"><Replace /> Change to…</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(24rem,70vh)] w-64 overflow-y-auto">
        {targets.map((t) => (
          <DropdownMenuItem key={t.type} onSelect={() => onConvert(t.type)} data-testid={`change-to-${t.type}`}>
            <span className="grid"><b className="text-[13px] text-ink">{t.name}</b><span className="text-[11px] text-muted-foreground">{t.about}</span></span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Swap with…": trade places with any block beside this one. A width set on a block in a row goes with it. */
function SwapMenu({ siblings, onSwap }: { siblings: { id: string; label: string }[]; onSwap: (id: string) => void }) {
  if (!siblings.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="xs" data-testid="swap-with" aria-label="Swap places with another block"><ArrowLeftRight /> Swap with…</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(24rem,70vh)] w-64 overflow-y-auto">
        {siblings.map((s) => <DropdownMenuItem key={s.id} onSelect={() => onSwap(s.id)} data-testid="swap-option"><span className="min-w-0 truncate text-[13px]">{s.label}</span></DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Advanced: for exact control of one block: a link target, your own class names, and CSS that applies to this block alone. */
function AdvancedFields({ block, onPatch }: { block: SiteBlock; onPatch: (p: Record<string, unknown>) => void }) {
  const text = (k: string) => (typeof block[k] === "string" ? (block[k] as string) : "")
  const set = (k: string) => (v: string) => onPatch({ [k]: v.trim() ? v : undefined })
  const anchor = cleanAnchor(block.anchor), ignored = text("css") !== "" && cleanDeclarations(block.css) !== text("css").trim()
  return (
    <div className="grid gap-3" data-testid="advanced-fields">
      <div className="grid gap-1">
        <Label htmlFor={`${block.id}-anchor`} className={fieldLabel}>Anchor (id)</Label>
        <Input id={`${block.id}-anchor`} className="h-8 font-mono text-xs" value={text("anchor")} onChange={(e) => set("anchor")(e.target.value)} placeholder="pricing" />
        <span className="text-[11px] text-faint">{anchor ? <>A link to <code className="font-mono">#{anchor}</code> jumps straight here.</> : "Lets a link such as /page/#pricing jump straight to this block."}</span>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${block.id}-classes`} className={fieldLabel}>Extra CSS classes</Label>
        <Input id={`${block.id}-classes`} className="h-8 font-mono text-xs" value={text("classes")} onChange={(e) => set("classes")(e.target.value)} placeholder="highlight wide-card" />
        <span className="text-[11px] text-faint">Class names you can style from Look → Your CSS{cleanClasses(block.classes) ? <>: <code className="font-mono">.{cleanClasses(block.classes).split(" ").join(" .")}</code></> : ""}.</span>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${block.id}-css`} className={fieldLabel}>Your CSS for this block</Label>
        <Textarea id={`${block.id}-css`} rows={7} className="font-mono text-xs" value={text("css")} onChange={(e) => set("css")(e.target.value)} placeholder={"background: #fff7e6;\nborder-radius: 20px;\nletter-spacing: .04em;"} spellCheck={false} />
        <span className="text-[11px] text-faint">Properties only, no braces. It applies to this block and nothing else, and shows in the preview as you type. The block's own class is <code className="font-mono">.{blockClass(block)}</code>, if you'd rather write the rule in Look → Your CSS.</span>
        {ignored && <span className="text-[11px] text-amber">Some characters ({"{ } < > \\"} and @import) are left out when the site is built.</span>}
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
      <div className="flex items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">Page settings</h2><span className="rounded-full bg-ink-2/8 px-2 py-0.5 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase" data-testid="page-scope">This page</span><StateChip state={pageState(page, site)} /></div>
      <p className="-mt-1.5 text-xs leading-snug text-muted-foreground">Click anything in the preview to edit it. Colors, header and footer are in <b className="font-semibold text-ink-2">Look</b> and <b className="font-semibold text-ink-2">Site settings</b> above.</p>
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
export function Inspector({ site, page, pages, block, blockTitle, trail, targets, changeOpen, onChangeOpen, onConvert, siblings, onSwap, inRow, onEvenOut, onPatch, onDuplicate, onRemove }: {
  site: Site; page: SitePage | undefined; pages: SitePage[]; block: SiteBlock | undefined; blockTitle: string; trail: string
  targets: ConvertTarget[]; changeOpen: boolean; onChangeOpen: (open: boolean) => void; onConvert: (type: string) => void
  siblings: { id: string; label: string }[]; onSwap: (id: string) => void; inRow: boolean; onEvenOut?: () => void
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
          <SwapMenu siblings={siblings} onSwap={onSwap} />
          <ChangeMenu targets={targets} open={changeOpen} onOpenChange={onChangeOpen} onConvert={onConvert} />
          <Button variant="quiet" size="icon-xs" aria-label="Duplicate this block" title="Duplicate (⌘D)" onClick={onDuplicate}><Copy /></Button>
          <Button variant="quiet" size="icon-xs" aria-label="Remove this block" title="Remove (Delete)" onClick={onRemove}><Trash2 /></Button>
        </div>
        <TabsList className="w-full"><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="style">Style</TabsTrigger><TabsTrigger value="links">Links</TabsTrigger><TabsTrigger value="advanced">Advanced</TabsTrigger></TabsList>
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
        {onEvenOut && <Button size="xs" variant="outline" className="mt-3" onClick={onEvenOut}>Even out the column widths</Button>}
      </TabsContent>
      <TabsContent value="style" className="min-h-0 flex-1 overflow-y-auto p-3"><StyleFields block={block} onPatch={onPatch} inRow={inRow} /></TabsContent>
      <TabsContent value="advanced" className="min-h-0 flex-1 overflow-y-auto p-3"><AdvancedFields block={block} onPatch={onPatch} /></TabsContent>
      <TabsContent value="links" className="min-h-0 flex-1 overflow-y-auto p-3"><RecordTasks kind="page" id={page.id} name={page.title} /></TabsContent>
    </Tabs>
  )
}
