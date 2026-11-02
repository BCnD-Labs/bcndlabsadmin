import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Monitor, Plus, Rocket, Smartphone, Tablet, Trash2 } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ADDABLE, BLOCKS, SECTIONS, SECTION_ORDER, mk, renderPage, section, type BlockField } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { OptionSelect } from "@/components/forms/fields"
import { cmsPagesHref } from "@/lib/routes"
import type { SiteBlock, SitePage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { slugify } from "./cms-forms"
import { StateChip, pageState } from "./pages-tab"
import { publishSite } from "./use-cms"

/* Tree helpers: blocks are nested (section → row → card → content). */
function mapTree(list: SiteBlock[], id: string, fn: (b: SiteBlock) => SiteBlock | null): SiteBlock[] {
  return list.flatMap((b) => {
    if (b.id === id) {
      const r = fn(b)
      return r ? [r] : []
    }
    return [b.kids ? { ...b, kids: mapTree(b.kids, id, fn) } : b]
  })
}
function moveIn(list: SiteBlock[], id: string, d: -1 | 1): SiteBlock[] {
  const i = list.findIndex((b) => b.id === id)
  if (i >= 0) {
    const j = i + d
    if (j < 0 || j >= list.length) return list
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  }
  return list.map((b) => (b.kids ? { ...b, kids: moveIn(b.kids, id, d) } : b))
}

const WIDTHS = { desktop: "100%", tablet: "820px", phone: "390px" } as const

function FieldInput({ f, value, onChange, id }: { f: BlockField; value: unknown; onChange: (v: unknown) => void; id: string }) {
  const forms = useWorkspace((s) => s.forms)
  const openForm = useUi((s) => s.openForm)
  const v = value == null ? "" : String(value)
  if (f.kind === "big") return <Textarea id={id} rows={f.k === "md" ? 6 : 3} value={v} onChange={(e) => onChange(e.target.value)} className="font-[inherit] text-[13px]" />
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

/** One block in the outline: its name, a one-line peek, and (open) its fields and children. */
function BlockNode({ b, depth, open, onToggle, onChange, onMove, onRemove, onAdd }: {
  b: SiteBlock; depth: number; open: Set<string>; onToggle: (id: string) => void
  onChange: (id: string, patch: Record<string, unknown>) => void; onMove: (id: string, d: -1 | 1) => void; onRemove: (id: string) => void; onAdd: (parent: string, type: string) => void
}) {
  const def = BLOCKS[b.type]
  if (!def) return null
  const isOpen = open.has(b.id)
  const peek = String(b.text ?? b.md ?? b.items ?? b.alt ?? "").split("\n")[0].slice(0, 60)
  return (
    <li>
      <div className={cn("group flex items-center gap-1 rounded-[8px] py-1 pr-1 hover:bg-raised", isOpen && "bg-raised")} style={{ paddingLeft: 4 + depth * 14 }}>
        <button type="button" onClick={() => onToggle(b.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={isOpen}>
          {isOpen ? <ChevronDown className="size-3.5 shrink-0 text-faint" /> : <ChevronRight className="size-3.5 shrink-0 text-faint" />}
          <span className={cn("shrink-0 text-[12.5px]", def.container ? "font-semibold text-ink-2" : "text-ink")}>{def.name}</span>
          {peek && <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">{peek}</span>}
        </button>
        <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <Button variant="quiet" size="icon-xs" aria-label={`Move ${def.name} up`} onClick={() => onMove(b.id, -1)}><ArrowUp /></Button>
          <Button variant="quiet" size="icon-xs" aria-label={`Move ${def.name} down`} onClick={() => onMove(b.id, 1)}><ArrowDown /></Button>
          <Button variant="quiet" size="icon-xs" aria-label={`Remove ${def.name}`} onClick={() => onRemove(b.id)}><Trash2 /></Button>
        </span>
      </div>
      {isOpen && def.edit && (
        <div className="my-1 grid gap-2.5 rounded-[10px] bg-well p-3" style={{ marginLeft: 4 + depth * 14 }}>
          {def.edit.map((f) => (
            <div key={f.k} className="grid gap-1">
              <Label htmlFor={`${b.id}-${f.k}`} className="text-[11.5px] font-normal text-muted-foreground">{f.l}</Label>
              <FieldInput id={`${b.id}-${f.k}`} f={f} value={b[f.k]} onChange={(v) => onChange(b.id, { [f.k]: v })} />
              {f.note && <span className="text-[11px] text-faint">{f.note}</span>}
            </div>
          ))}
        </div>
      )}
      {def.container && (isOpen || depth > 0) && (
        <ul>
          {(b.kids ?? []).map((k) => <BlockNode key={k.id} b={k} depth={depth + 1} open={open} onToggle={onToggle} onChange={onChange} onMove={onMove} onRemove={onRemove} onAdd={onAdd} />)}
          <li style={{ paddingLeft: 4 + (depth + 1) * 14 }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="quiet" size="xs" className="text-muted-foreground"><Plus /> Block</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-52 overflow-y-auto">
                <DropdownMenuLabel className="bw-label">Add to {def.name.toLowerCase()}</DropdownMenuLabel>
                {ADDABLE.filter((t) => t !== b.type).map((t) => <DropdownMenuItem key={t} onSelect={() => onAdd(b.id, t)}>{BLOCKS[t].name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
      )}
    </li>
  )
}

export function PageEditor() {
  const { id = "" } = useParams()
  const page = useWorkspace((s) => s.pages.find((p) => p.id === id))
  const site = useWorkspace((s) => s.sites.find((x) => x.id === page?.siteId))
  const allPages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const forms = useWorkspace((s) => s.forms)
  const { update } = useWorkspace.getState()
  const [width, setWidth] = useState<keyof typeof WIDTHS>("desktop")
  const [open, setOpen] = useState<Set<string>>(() => new Set(page?.sections[0] ? [page.sections[0].id] : []))
  const [busy, setBusy] = useState(false)
  const slugAtFocus = useRef<string | null>(null)

  const pages = useMemo(() => allPages.filter((p) => p.siteId === site?.id), [allPages, site?.id])
  const posts = useMemo(() => drafts.filter((d) => d.siteId === site?.id && d.publishedAt), [drafts, site?.id])
  const html = useMemo(() => (site && page ? renderPage(site, pages, page, { preview: true, posts, forms }) : ""), [site, page, pages, posts, forms])

  if (!page || !site) {
    return (
      <>
        <PageHeader title="Page not found" back={{ to: cmsPagesHref, label: "Pages" }} />
        <Panel category="website" title="Page"><EmptyState title="This page doesn't exist" action={<Button variant="outline" asChild><Link to={cmsPagesHref}>Back to pages</Link></Button>}>It may have been deleted.</EmptyState></Panel>
      </>
    )
  }

  const set = (patch: Partial<SitePage>) => update("pages", page.id, patch)
  const setSections = (sections: SiteBlock[]) => set({ sections })
  const toggle = (bid: string) => setOpen((o) => { const n = new Set(o); if (n.has(bid)) n.delete(bid); else n.add(bid); return n })
  const handlers = {
    onToggle: toggle,
    onChange: (bid: string, patch: Record<string, unknown>) => setSections(mapTree(page.sections, bid, (b) => ({ ...b, ...patch }))),
    onMove: (bid: string, d: -1 | 1) => setSections(moveIn(page.sections, bid, d)),
    onRemove: (bid: string) => setSections(mapTree(page.sections, bid, () => null)),
    onAdd: (parent: string, type: string) => {
      const nb = mk(type)
      setSections(mapTree(page.sections, parent, (b) => ({ ...b, kids: [...(b.kids ?? []), nb] })))
      setOpen((o) => new Set([...o, parent, nb.id]))
    },
  }
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

  return (
    <>
      <PageHeader
        back={{ to: cmsPagesHref, label: "Pages" }}
        title={page.title || "Untitled page"}
        badge={<StateChip state={pageState(page, site)} />}
        actions={<Button disabled={busy} onClick={async () => { setBusy(true); try { await publishSite(site) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }}><Rocket /> {busy ? "Publishing…" : "Publish site"}</Button>}
      />
      <div className="@container/main mx-auto w-full max-w-[var(--bw-page-max)]">
        <div className="grid grid-cols-1 items-start gap-[var(--bw-grid-gap)] @4xl/main:grid-cols-[400px_minmax(0,1fr)]">
          <div className="grid gap-[var(--bw-grid-gap)]">
            <Panel category="website" title="Page" bodyClassName="grid gap-3 px-3.5 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label htmlFor="pg-title" className="text-[11.5px] font-normal text-muted-foreground">Title</Label><Input id="pg-title" className="h-8" value={page.title} onChange={(e) => set({ title: e.target.value })} /></div>
                <div className="grid gap-1">
                  <Label htmlFor="pg-slug" className="text-[11.5px] font-normal text-muted-foreground">Address</Label>
                  <div className="flex items-center gap-1"><span className="text-muted-foreground">/</span>
                    <Input id="pg-slug" className="h-8 font-mono text-xs" disabled={!page.slug && pages.length > 0 && page.order === Math.min(...pages.map((p) => p.order))} value={page.slug} placeholder="home" aria-invalid={clash}
                      onFocus={() => (slugAtFocus.current = page.slug)} onBlur={commitSlug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
                  </div>
                  {clash && <span className="text-[11px] text-red-text">Another page uses this address.</span>}
                </div>
              </div>
              <div className="grid gap-1"><Label htmlFor="pg-desc" className="text-[11.5px] font-normal text-muted-foreground">Description (search and share text)</Label><Input id="pg-desc" className="h-8" value={page.description} onChange={(e) => set({ description: e.target.value })} placeholder="One sentence about this page" /></div>
              <div className="flex items-center gap-2"><Switch id="pg-menu" checked={page.inMenu} onCheckedChange={(inMenu) => set({ inMenu })} /><Label htmlFor="pg-menu" className="text-xs font-normal">In the site menu</Label></div>
            </Panel>
            <Panel
              category="website"
              title="Sections"
              meta={`${page.sections.length} on this page`}
              actions={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Plus /> Section</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
                    <DropdownMenuLabel className="bw-label">Add a section</DropdownMenuLabel>
                    {SECTION_ORDER.map((k) => (
                      <DropdownMenuItem key={k} className="items-start py-1.5" onSelect={() => { const s = section(k); setSections([...page.sections, s]); setOpen((o) => new Set([...o, s.id])) }}>
                        <span className="flex flex-col"><span className="text-[13px] text-ink">{SECTIONS[k].name}</span><span className="text-[11px] text-muted-foreground">{SECTIONS[k].about}</span></span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onSelect={() => { const s = mk("section"); setSections([...page.sections, s]); setOpen((o) => new Set([...o, s.id])) }}>Empty section</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
              bodyClassName="px-2 py-2"
            >
              {page.sections.length ? (
                <ul className="grid gap-0.5" aria-label="Page outline">
                  {page.sections.map((s) => (
                    <li key={s.id} className="rounded-[10px] bg-raised/40 py-0.5">
                      <ul><BlockNode b={{ ...s }} depth={0} open={open} {...handlers} /></ul>
                      {s.preset && SECTIONS[s.preset] && !open.has(s.id) && <p className="px-7 pb-1 text-[11px] text-faint">{SECTIONS[s.preset].name}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">Add a section to start this page.</p>
              )}
            </Panel>
          </div>
          <Panel
            category="website"
            title="Preview"
            subtitle={<span className="font-mono">{site.domain || site.name}/{page.slug}</span>}
            actions={
              <div role="radiogroup" aria-label="Preview width" className="flex gap-0.5 rounded-[8px] bg-well p-0.5">
                {([["desktop", Monitor], ["tablet", Tablet], ["phone", Smartphone]] as const).map(([w, Icon]) => (
                  <button key={w} type="button" role="radio" aria-checked={width === w} aria-label={w} title={w} onClick={() => setWidth(w)} className={cn("flex size-7 items-center justify-center rounded-[6px]", width === w ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink")}><Icon className="size-3.5" /></button>
                ))}
              </div>
            }
            bodyClassName="flex justify-center bg-well p-3"
            className="@4xl/main:sticky @4xl/main:top-[calc(var(--bw-header-h,88px)+12px)]"
          >
            <iframe title={`Preview of ${page.title}`} srcDoc={html} sandbox="allow-same-origin" className="h-[min(78vh,900px)] max-w-full rounded-[8px] bg-white" style={{ width: WIDTHS[width] }} />
          </Panel>
        </div>
      </div>
    </>
  )
}
