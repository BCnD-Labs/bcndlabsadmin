import { Accessibility, Blocks, ChevronLeft, Eye, Inbox, Layers, LayoutTemplate, Monitor, Palette, PanelRight, Plus, Redo2, Rocket, Settings2, Smartphone, Tablet, Undo2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { usePanelRef, type Layout } from "react-resizable-panels"
import { toast } from "sonner"
import { imagePathsIn } from "@shared/assets"
import { BLOCKS, mk, renderPage, section } from "@shared/sitebuilder"
import { duplicateBlock, findBlock, indentBlock, mapTree, moveBlock, moveKeepingWidths, nudgeKeepingWidths, outdentBlock, pathTo, freezeAround as freezeAroundOf, siblingsIn, swapBlocks } from "@shared/sitebuilder-tree"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { usePreviewPictures } from "@/features/assets/use-assets"
import { cmsPagesHref, draftHref, sitePageHref, sitesHref } from "@/lib/routes"
import type { Site, SiteBlock, SitePage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useConnections } from "@/services/connector"
import { useWorkspaceSync } from "@/services/workspace-sync"
import { usePrefs } from "@/stores/prefs"
import { safeLocalStorage } from "@/stores/storage"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { AdoptedWorkspace } from "./adopted-site"
import { FilesPanel } from "./files-panel"
import { FormsPanel } from "./forms-panel"
import { Inspector } from "./inspector"
import { LayersPane, blockName } from "./layers-pane"
import { A11yPanel, KIND_INFO } from "./a11y-panel"
import { ComponentsPanel } from "./components-panel"
import { placeBlock, type LibraryItem } from "@shared/site-library"
import { convertBlock, convertTargets } from "@shared/site-convert"
import { LookPanel } from "./look-panel"
import { auditSite, type A11yItem } from "@shared/site-a11y"
import { SectionsPane } from "./sections-pane"
import { PagesPane } from "./pages-pane"
import { PostsPanel } from "./posts-panel"
import { StateChip, pageState } from "./publish-bar"
import { SectionGallery } from "./section-gallery"
import { SettingsPanel } from "./settings-panel"
import { SetupGuide } from "./setup-guide"
import { SitePreview, type BlockAction, type CanvasEditing } from "./site-preview"
import { SiteViewer } from "./sites-page"
import { SiteSwitcher } from "./site-switcher"
import { selectSite, useCurrentSite, usePublishRuns, useUnpublished } from "./use-cms"
import { useSiteHistory } from "./use-site-history"

/** Every side panel: what it is called, whether it changes this page or the whole site, and one plain sentence about it. */
const PANELS = {
  components: { title: "Components", icon: Blocks, scope: "Adds to this page", about: "" },
  look: { title: "Look", icon: Palette, scope: "Whole site", about: "Colors, text and shape for every page. The preview changes as you click." },
  access: { title: "Accessibility", icon: Accessibility, scope: "This page or the whole site", about: "" },
  forms: { title: "Forms", icon: Inbox, scope: "Whole site", about: "What visitors send you, and the forms it comes from." },
  settings: { title: "Site settings", icon: Settings2, scope: "Whole site", about: "Name, domain, header and footer, where it publishes, and how forms are received." },
  files: { title: "Publish", icon: Rocket, scope: "Whole site", about: "Check the site, put it online, or download the files for VS Code or any host." },
  posts: { title: "Posts", icon: Layers, scope: "Whole site", about: "" },
} as const
export type WorkspacePanel = keyof typeof PANELS
/** The toolbar's panel buttons in groups, so what each one changes reads at a glance. Publish stands apart at the end. */
const TOOLBAR_GROUPS: { label: string; panels: WorkspacePanel[] }[] = [
  { label: "Add to the page", panels: ["components"] },
  { label: "Whole site", panels: ["look", "settings", "forms"] },
  { label: "Check", panels: ["access"] },
]

const DEVICES = { desktop: { width: "100%", icon: Monitor }, tablet: { width: "820px", icon: Tablet }, phone: { width: "390px", icon: Smartphone } } as const
const LAYOUT_KEY = "blackwall.pagesmith-layout"
const NARROW = 900
const INLINE_TEXT = new Set(["heading", "text", "button", "link", "badge", "alert"])

function savedLayout(): Layout | undefined {
  try { return JSON.parse(safeLocalStorage.getItem(LAYOUT_KEY) as string) ?? undefined } catch { return undefined }
}

/** /cms/pages and /cms/pages/:id. A site run from its own files has its own, simpler workspace; every other site gets the editor. */
export function SiteWorkspace() {
  const { id } = useParams()
  const current = useCurrentSite()
  if (!id && current?.adopted) return <AdoptedWorkspace site={current} />
  return <PagesmithWorkspace />
}

/** The Pagesmith editor. Without a page in the address it opens the site's home page, keeping any ?panel=. */
function PagesmithWorkspace() {
  const { id } = useParams()
  const { search } = useLocation()
  const openForm = useUi((s) => s.openForm)
  const ready = useWorkspaceSync((s) => s.ready)
  const allPages = useWorkspace((s) => s.pages)
  const current = useCurrentSite()
  const sites = useWorkspace((s) => s.sites)
  const page = allPages.find((p) => p.id === id)
  const site = sites.find((x) => x.id === page?.siteId) ?? current
  const siteOfPage = page?.siteId
  useEffect(() => { if (siteOfPage) selectSite(siteOfPage) }, [siteOfPage])

  if (!site) {
    return (
      <>
        <PageHeader title="Website" />
        <Panel category="website" title="Sites">
          <EmptyState roomy icon={LayoutTemplate} title="Build and run your websites from here" action={<Button onClick={() => openForm({ kind: "site" })}><Plus /> New site</Button>}>
            Pick a starting point, make it yours with ready-made sections, write posts, then get the finished files to put on your host.
          </EmptyState>
        </Panel>
      </>
    )
  }
  if (!page && (!id || ready)) {
    const own = allPages.filter((p) => p.siteId === site.id).sort((a, b) => a.order - b.order)
    const home = own.find((p) => p.slug === "") ?? own[0]
    if (home) return <Navigate to={sitePageHref(home.id) + search} replace />
  }
  return <Workspace key={site.id} site={site} page={page} />
}

function Workspace({ site, page }: { site: Site; page: SitePage | undefined }) {
  const navigate = useNavigate()
  const { search } = useLocation()
  const openForm = useUi((s) => s.openForm)
  const allPages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const forms = useWorkspace((s) => s.forms)
  const library = useWorkspace((s) => s.assets)
  const { update } = useWorkspace.getState()
  const { undo, redo, canUndo, canRedo } = useSiteHistory(site.id)
  const layersTree = usePrefs((s) => s.layersTree)
  const publishing = usePublishRuns((s) => s.runs[site.id]?.state === "publishing")
  const unpublished = useUnpublished(site).count
  useEffect(() => { void useConnections.getState().refresh() }, [])
  const setPref = usePrefs((s) => s.set)

  const [selected, setSelected] = useState<string | null>(null)
  const [marksOn, setMarksOn] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop")
  const [viewing, setViewing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [pagesSheet, setPagesSheet] = useState(false)
  const [inspectorSheet, setInspectorSheet] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const activeHere = useRef(true)
  const rightPane = usePanelRef()

  const pageId = page?.id
  useEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => setNarrow(el.clientWidth < NARROW)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pages = useMemo(() => allPages.filter((p) => p.siteId === site.id), [allPages, site.id])
  const posts = useMemo(() => drafts.filter((d) => d.siteId === site.id && d.publishedAt), [drafts, site.id])
  const paths = useMemo(() => (page ? imagePathsIn(page.sections) : []), [page])
  const pictures = usePreviewPictures(paths)
  const html = useMemo(() => (page ? renderPage(site, pages, page, { preview: true, edit: true, posts, forms, assets: library, assetUrls: pictures }) : ""), [site, page, pages, posts, forms, library, pictures])

  const asked = new URLSearchParams(search).get("panel")
  const panel: WorkspacePanel | null = asked && asked in PANELS ? (asked as WorkspacePanel) : null
  const here = page ? sitePageHref(page.id) : cmsPagesHref
  const setPanel = useCallback((p: WorkspacePanel | null) => navigate(p ? `${here}?panel=${p}` : here), [navigate, here])

  // A panel needs more room than the inspector; it goes back when the panel closes.
  const panelOpen = !!panel
  const roomBefore = useRef<number | null>(null)
  useEffect(() => {
    const pane = rightPane.current
    if (!pane) return
    if (panelOpen) {
      if (roomBefore.current === null) roomBefore.current = pane.getSize().asPercentage
      if (pane.getSize().asPercentage < 36) pane.resize("36%")
    } else if (roomBefore.current !== null) {
      pane.resize(`${roomBefore.current}%`)
      roomBefore.current = null
    }
  }, [panelOpen, narrow, rightPane])

  const headerBlocks = site.headerBlocks ?? []
  const block = (page && selected ? findBlock(page.sections, selected) : undefined) ?? (selected ? findBlock(headerBlocks, selected) : undefined)
  const selectedId = block?.id ?? null
  const setSections = (sections: SiteBlock[]) => { if (page) update("pages", page.id, { sections }) }
  const setHeader = (list: SiteBlock[]) => update("sites", site.id, { headerBlocks: list.length ? list : undefined })
  /** Which list a block lives in: this page's sections, or the site's header items. */
  const treeOf = (id: string) => (page && findBlock(page.sections, id) ? { list: page.sections, set: setSections, header: false } : findBlock(headerBlocks, id) ? { list: headerBlocks, set: setHeader, header: true } : null)
  /** The kinds a block can become here: a card can't go inside a card. */
  const targetsFor = (id: string) => {
    const t = treeOf(id), b = t && findBlock(t.list, id)
    if (!t || !b) return []
    const path = pathTo(t.list, id) ?? [], parent = path.length > 1 ? findBlock(t.list, path[path.length - 2]) : undefined
    return convertTargets(b, t.header ? "header" : "page").filter((x) => !(x.type === "card" && parent?.type === "card"))
  }
  /** The row a block sits directly in, if it sits in one. */
  const rowOf = (id: string) => {
    const t = treeOf(id), here = t && siblingsIn(t.list, id), parent = here?.parentId && t ? findBlock(t.list, here.parentId) : undefined
    return parent?.type === "row" ? parent : undefined
  }
  /** What the blocks beside this one are called, for "Swap with…". */
  const siblingsOfBlock = (id: string) => {
    const t = treeOf(id), here = t && siblingsIn(t.list, id)
    if (!t || !here) return []
    const peek = (b: SiteBlock) => String(b.text ?? b.md ?? b.label ?? (b.kids ?? []).find((k) => k.type === "heading")?.text ?? (b.kids ?? []).find((k) => k.text)?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 28)
    return here.sibs.filter((b) => b.id !== id).map((b) => ({ id: b.id, label: `${blockName(b, here.parentId === null && !t.header)}${peek(b) ? ` · ${peek(b)}` : ""}` }))
  }
  const swapWith = (id: string, otherId: string) => {
    const t = treeOf(id)
    if (!t) return
    const next = swapBlocks(freezeAroundOf(t.list, id), id, otherId)
    if (next !== t.list) t.set(next)
  }
  const evenOut = (rowId: string) => {
    const t = treeOf(rowId)
    if (t) t.set(mapTree(t.list, rowId, (r) => ({ ...r, kids: (r.kids ?? []).map((k) => { const { span: _span, ...rest } = k.design ?? {}; const next = { ...k }; if (Object.keys(rest).length) next.design = rest; else delete next.design; return next }) })))
  }
  const convert = (id: string, to: string) => {
    const t = treeOf(id), b = t && findBlock(t.list, id)
    if (!t || !b) return
    t.set(mapTree(t.list, id, (x) => convertBlock(x, to, t.header ? "header" : "page")))
    setChangeOpen(false)
    toast(`${BLOCKS[b.type]?.name ?? "Block"} changed to ${BLOCKS[to]?.name ?? to}`, { action: { label: "Undo", onClick: doUndo } })
  }
  /** From the component library: add the piece where the selection (or the end of the page) says. The panel stays open to add more. */
  const insertItem = (item: LibraryItem) => {
    if (!page) return
    const nb = item.make()
    const inPage = !!selected && !!findBlock(page.sections, selected)
    setSections(placeBlock(page.sections, inPage ? selected : null, nb))
    setSelected(nb.id)
    toast.success(`${item.name} added`)
  }
  /** Adds the piece and selects it; selecting closes the panel, so its editor shows next to the preview. */
  const addHeaderItem = (type: string) => { const nb = mk(type); setHeader([...headerBlocks, nb]); select(nb.id) }

  /** After undo or redo, show the page that changed if it isn't the one on screen. */
  const showChanged = (ids: string[]) => {
    const other = ids.length === 1 && ids[0] !== pageId ? useWorkspace.getState().pages.find((p) => p.id === ids[0]) : undefined
    if (other) navigate(sitePageHref(other.id))
  }
  const doUndo = () => showChanged(undo())
  const doRedo = () => showChanged(redo())

  const select = (id: string) => {
    setSelected(id)
    if (panel) setPanel(null)
    if (page) setCollapsed((c) => { const path = pathTo(page.sections, id) ?? []; return path.some((x) => x !== id && c.has(x)) ? new Set([...c].filter((x) => x === id || !path.includes(x))) : c })
    requestAnimationFrame(() => root.current?.querySelector(`[data-tree-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" }))
  }
  /** Accessibility findings as badges on this page's blocks, only while they are switched on. */
  const marks = useMemo(() => {
    if (!marksOn || !page) return undefined
    return auditSite(site, allPages, library, drafts).items.filter((i) => i.blockId && i.pageId === page.id).map((i) => ({ id: i.blockId!, glyph: KIND_INFO[i.kind].glyph, color: KIND_INFO[i.kind].badge, text: i.text }))
  }, [marksOn, page, site, allPages, library, drafts])
  /** From a finding: go to its page and block, or to the colours. */
  const showFinding = (item: A11yItem) => {
    if (item.area === "look") return setPanel("look")
    if (item.pageId && item.pageId !== page?.id) navigate(sitePageHref(item.pageId))
    if (item.blockId) select(item.blockId)
    else setPanel(null)
  }
  const removeBlock = (id: string) => {
    const t = treeOf(id)
    if (!t) return
    const b = findBlock(t.list, id)
    t.set(mapTree(t.list, id, () => null))
    if (id === selected) setSelected(null)
    if (b) toast(`${BLOCKS[b.type]?.name ?? "Block"} removed`, { action: { label: "Undo", onClick: doUndo } })
  }
  const duplicate = (id: string) => {
    const t = treeOf(id)
    if (!t) return
    const { list, copyId } = duplicateBlock(t.list, id)
    t.set(list)
    if (copyId) setSelected(copyId)
  }
  const addBlock = (parent: string, type: string) => {
    if (!page) return
    const nb = mk(type)
    setSections(mapTree(page.sections, parent, (b) => ({ ...b, kids: [...(b.kids ?? []), nb] })))
    select(nb.id)
  }
  const addSection = (key: string) => {
    if (!page) return
    const s = key === "empty" ? mk("section") : section(key)
    const at = insertAt ?? page.sections.length
    setSections([...page.sections.slice(0, at), s, ...page.sections.slice(at)])
    setInsertAt(null)
    setSelected(s.id)
  }
  const patchBlock = (id: string, patch: Record<string, unknown>) => {
    const t = treeOf(id)
    if (!t) return
    t.set(mapTree(t.list, id, (b) => {
      const next = { ...b, ...patch }
      if (patch.design === undefined && "design" in patch) delete next.design
      return next
    }))
  }

  const follow = (href: string) => {
    const target = pages.find((p) => (p.slug ? `/${p.slug}/` : "/") === href)
    if (target) return void navigate(sitePageHref(target.id))
    const post = drafts.find((d) => d.siteId === site.id && `/posts/${d.slug}/` === href)
    if (post) navigate(draftHref(post.id))
  }

  /* Shortcuts work wherever the editor has focus, including inside the canvas frame, and leave typing in a field alone. */
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined)
  useEffect(() => {
    onKey.current = (e) => {
      const el = e.target as HTMLElement | null
      if (!activeHere.current || el?.closest?.("input, textarea, select, [contenteditable], [role=dialog], [role=menu]")) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); return e.shiftKey ? doRedo() : doUndo() }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); return doRedo() }
      if (e.key === "Escape") return setSelected(null)
      if (!selectedId || !page) return
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); return duplicate(selectedId) }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); return removeBlock(selectedId) }
      if (e.altKey && e.key.startsWith("Arrow")) {
        e.preventDefault()
        const moves = { ArrowUp: () => nudgeKeepingWidths(page.sections, selectedId, -1), ArrowDown: () => nudgeKeepingWidths(page.sections, selectedId, 1), ArrowLeft: () => outdentBlock(page.sections, selectedId), ArrowRight: () => indentBlock(page.sections, selectedId) } as Record<string, () => SiteBlock[]>
        const next = moves[e.key]?.()
        if (next && next !== page.sections) setSections(next)
      }
    }
  })
  useEffect(() => {
    const key = (e: KeyboardEvent) => onKey.current(e)
    const where = (e: PointerEvent) => { activeHere.current = !!root.current?.contains(e.target as Node) }
    document.addEventListener("keydown", key)
    document.addEventListener("pointerdown", where, true)
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", where, true) }
  }, [])

  const editing: CanvasEditing = {
    label: (id) => { const t = treeOf(id), b = t && findBlock(t.list, id); return t && b ? blockName(b, !t.header && t.list.some((s) => s.id === id)) : undefined },
    text: (id) => {
      const t = treeOf(id), b = t && findBlock(t.list, id)
      if (!b || !INLINE_TEXT.has(b.type)) return undefined
      return { value: String(b.text ?? ""), multiline: b.type === "text", placeholder: BLOCKS[b.type].name }
    },
    commit: (id, value) => patchBlock(id, { text: value }),
    insert: (at) => setInsertAt(at),
    deselect: () => setSelected(null),
    act: (id, action: BlockAction) => {
      if (action === "change") { select(id); setChangeOpen(true); if (narrow) setInspectorSheet(true); return }
      if (!page) return
      if (action === "remove") return removeBlock(id)
      if (action === "duplicate") return duplicate(id)
      if (action === "parent") { const path = pathTo(page.sections, id) ?? []; if (path.length > 1) select(path[path.length - 2]); return }
      const t = treeOf(id)
      if (!t) return
      const next = nudgeKeepingWidths(t.list, id, action === "up" ? -1 : 1)
      if (next !== t.list) t.set(next)
    },
    canChange: (id) => targetsFor(id).length > 0,
    axis: (id) => (rowOf(id) ? "x" : "y"),
    canGoUp: (id) => (page ? (pathTo(page.sections, id)?.length ?? 0) > 1 : false),
    key: (e) => onKey.current(e),
    activate: () => { activeHere.current = true },
  }

  const panelBody = panel && (
    panel === "components" ? <ComponentsPanel site={site} hint={block && !treeOf(block.id)?.header ? `inside or beside the selected ${blockName(block, false).toLowerCase()}` : "at the end of the page"} onInsert={insertItem} />
      : panel === "look" ? <LookPanel site={site} />
      : panel === "access" ? <A11yPanel site={site} pageId={page?.id} marks={marksOn} onMarks={setMarksOn} onShow={showFinding} />
      : panel === "forms" ? <FormsPanel site={site} />
        : panel === "settings" ? <SettingsPanel site={site} header={{ items: headerBlocks, onAdd: addHeaderItem, onSelect: select }} />
          : panel === "files" ? <FilesPanel site={site} onPanel={setPanel} />
            : <PostsPanel site={site} />
  )
  const right = panel ? (
    <div className="flex h-full min-h-0 flex-col" data-testid={`panel-${panel}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-line-soft py-1.5 pr-1.5 pl-3">
        <h2 className="text-[13px] font-semibold text-ink">{PANELS[panel].title}</h2>
        <span className="rounded-full bg-ink-2/8 px-2 py-0.5 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase" data-testid="panel-scope">{PANELS[panel].scope}</span>
        <Button variant="quiet" size="icon-xs" className="ml-auto" aria-label={`Close ${PANELS[panel].title}`} onClick={() => setPanel(null)}><X /></Button>
      </div>
      <div className="@container min-h-0 flex-1 overflow-y-auto p-2">
        {PANELS[panel].about && <p className="px-1.5 pb-2 text-xs leading-snug text-muted-foreground" data-testid="panel-about">{PANELS[panel].about}</p>}
        {panelBody}
      </div>
    </div>
  ) : (
    <Inspector site={site} page={page} pages={pages} block={block} blockTitle={block ? blockName(block, !!page?.sections.some((s) => s.id === block.id)) : ""}
      targets={block ? targetsFor(block.id) : []} changeOpen={changeOpen} onChangeOpen={setChangeOpen} onConvert={(to) => block && convert(block.id, to)}
      siblings={block ? siblingsOfBlock(block.id) : []} onSwap={(otherId) => block && swapWith(block.id, otherId)} inRow={!!block && !!rowOf(block.id)} onEvenOut={block?.type === "row" && (block.kids ?? []).some((k) => k.design?.span) ? () => evenOut(block.id) : undefined}
      trail={treeOf(block?.id ?? "")?.header ? "In the header" : page && block ? (pathTo(page.sections, block.id) ?? []).slice(0, -1).map((id, i) => { const b = findBlock(page.sections, id); return b ? blockName(b, i === 0) : "" }).join(" › ") : ""}
      onPatch={(p) => block && patchBlock(block.id, p)} onDuplicate={() => block && duplicate(block.id)} onRemove={() => block && removeBlock(block.id)} />
  )
  const pagesPane = <PagesPane site={site} pages={pages} currentId={page?.id} onDragging={setDragging} onPanel={setPanel} />
  const layersPane = page && !layersTree ? (
    <SectionsPane site={site} sections={page.sections} selectedId={page && selectedId ? pathTo(page.sections, selectedId)?.[0] ?? null : null} posts={posts} forms={forms} assets={library} pictures={pictures} onDragging={setDragging}
      onSelect={select} onRemove={removeBlock} onDuplicate={duplicate} onAdd={() => setInsertAt(page.sections.length)} onTree={() => setPref({ layersTree: true })}
      onMove={(id, beforeId) => setSections(moveBlock(page.sections, id, null, beforeId))} />
  ) : page ? (
    <LayersPane sections={page.sections} selectedId={selectedId} collapsed={collapsed} onDragging={setDragging} onPictures={() => setPref({ layersTree: false })}
      onToggle={(id) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })}
      onSelect={select} onRemove={removeBlock} onAdd={addBlock} onAddSection={() => setInsertAt(page.sections.length)}
      onMove={(id, parentId, beforeId) => setSections(moveKeepingWidths(page.sections, id, parentId, beforeId))} />
  ) : <p className="p-3 text-xs text-muted-foreground">Add a page to see its layers.</p>
  const left = (
    <ResizablePanelGroup orientation="vertical" id="pagesmith-left">
      <ResizablePanel id="pages" defaultSize="32%" minSize={90}>{pagesPane}</ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="layers" minSize={90}>{layersPane}</ResizablePanel>
    </ResizablePanelGroup>
  )
  const canvas = (
    <div className="relative flex h-full min-h-0 min-w-0 justify-center overflow-auto bg-well p-2" data-testid="canvas">
      {page ? <SitePreview key={page.id} html={html} title={`Preview of ${page.title}`} width={DEVICES[device].width} selectedId={selectedId} onBlock={select} onLink={follow} editing={editing} marks={marks} className="h-full" />
        : <div className="grid place-items-center"><EmptyState icon={LayoutTemplate} title="This site has no pages yet" action={<Button onClick={() => openForm({ kind: "sitePage" })}><Plus /> New page</Button>} /></div>}
      {narrow && block && <Button size="sm" className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md" onClick={() => setInspectorSheet(true)}>Edit {blockName(block, false).toLowerCase()}</Button>}
    </div>
  )

  return (
    <div ref={root} className={cn("bw-site-workspace flex min-h-0 flex-1 flex-col overflow-hidden", dragging && "[&_iframe]:pointer-events-none")}>
      <PageHeader title={site.name} />
      <header className="@container/top flex shrink-0 flex-wrap items-center gap-1 border-b border-line-soft px-2 py-1.5">
        <Button variant="quiet" size="icon-sm" asChild><Link to={sitesHref} aria-label="All sites" title="All sites"><ChevronLeft /></Link></Button>
        <SiteSwitcher onPick={() => navigate(cmsPagesHref)} />
        {page && <span className="flex min-w-0 items-center gap-1.5 px-1.5"><span className="max-w-44 truncate text-[13px] font-semibold text-ink" data-testid="page-name">{page.title || "Untitled"}</span><span className="hidden @3xl/top:inline-flex"><StateChip state={pageState(page, site)} /></span></span>}
        {narrow && <Button variant="outline" size="sm" onClick={() => setPagesSheet(true)}><Layers /> Pages</Button>}
        <div role="radiogroup" aria-label="Preview width" className="mx-auto flex gap-0.5 rounded-[8px] bg-well p-0.5">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((w) => { const Icon = DEVICES[w].icon; return <button key={w} type="button" role="radio" aria-checked={device === w} aria-label={w} title={w} onClick={() => setDevice(w)} className={cn("flex size-7 items-center justify-center rounded-[6px]", device === w ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink")}><Icon className="size-3.5" /></button> })}
        </div>
        <Button variant="quiet" size="icon-sm" aria-label="Undo" title="Undo (⌘Z)" disabled={!canUndo} onClick={doUndo}><Undo2 /></Button>
        <Button variant="quiet" size="icon-sm" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={doRedo}><Redo2 /></Button>
        <span className="mx-0.5 h-5 w-px bg-line-soft" aria-hidden />
        <SetupGuide site={site} onPanel={setPanel} />
        <Button variant="quiet" size="sm" title="Walk through the site as visitors see it" onClick={() => setViewing(true)}><Eye /><span className="hidden @4xl/top:inline">View</span></Button>
        {TOOLBAR_GROUPS.map((g) => (
          <div key={g.label} role="group" aria-label={g.label} className="flex items-center gap-0.5 rounded-[8px] bg-well p-0.5 ring-1 ring-line-soft" title={g.label}>
            {g.panels.map((p) => { const Icon = PANELS[p].icon; return <Button key={p} variant={panel === p ? "secondary" : "quiet"} size="sm" aria-pressed={panel === p} aria-label={PANELS[p].title} title={`${PANELS[p].title}: ${PANELS[p].scope.toLowerCase()}`} onClick={() => setPanel(panel === p ? null : p)}><Icon /><span className="hidden @4xl/top:inline">{PANELS[p].title}</span></Button> })}
          </div>
        ))}
        <Button size="sm" variant={panel === "files" ? "secondary" : "default"} aria-pressed={panel === "files"} aria-label="Publish" title={unpublished ? `Publish: ${unpublished} ${unpublished === 1 ? "change" : "changes"} since the files last left Blackwall` : "Publish: check the site, put it online or download the files"} data-testid="publish-button" onClick={() => setPanel(panel === "files" ? null : "files")}>
          <Rocket /><span className="hidden @4xl/top:inline">{publishing ? "Publishing…" : "Publish"}</span>{unpublished > 0 && !publishing && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-black/20 px-1 text-[10px] leading-none font-bold tabular-nums" aria-hidden>{unpublished}</span>}
        </Button>
        {narrow && <Button variant="quiet" size="icon-sm" aria-label="Inspector" title="Inspector" onClick={() => setInspectorSheet(true)}><PanelRight /></Button>}
      </header>
      <div className="min-h-0 flex-1">
        {narrow ? canvas : (
          <ResizablePanelGroup orientation="horizontal" id="pagesmith-workspace" defaultLayout={savedLayout()} onLayoutChanged={(layout) => { if (roomBefore.current === null) try { safeLocalStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch { /* Only the pane widths are lost. */ } }}>
            <ResizablePanel id="left" defaultSize="19%" minSize={200} maxSize="35%">{left}</ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="canvas" minSize={320}>{canvas}</ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="right" panelRef={rightPane} defaultSize="24%" minSize={260} maxSize="55%">{right}</ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      {narrow && (
        <>
          <Sheet open={pagesSheet} onOpenChange={setPagesSheet}><SheetContent side="left" className="w-[min(22rem,92vw)] gap-0 p-0 pt-9"><SheetTitle className="sr-only">Pages and layers</SheetTitle>{left}</SheetContent></Sheet>
          <Sheet open={inspectorSheet || !!panel} onOpenChange={(o) => { if (!o) { setInspectorSheet(false); if (panel) setPanel(null) } }}><SheetContent side="right" showCloseButton={!panel} className={cn("w-[min(30rem,96vw)] gap-0 p-0 sm:max-w-none", !panel && "pt-9")}><SheetTitle className="sr-only">{panel ? PANELS[panel].title : "Inspector"}</SheetTitle>{right}</SheetContent></Sheet>
        </>
      )}
      <SectionGallery open={insertAt !== null} onOpenChange={(o) => { if (!o) setInsertAt(null) }} site={site} posts={posts} forms={forms} onPick={addSection} />
      <Dialog open={viewing} onOpenChange={setViewing}><DialogContent className="gap-0 p-0 sm:max-w-5xl" aria-describedby={undefined}>{viewing && <SiteViewer site={site} onClose={() => setViewing(false)} inEditor />}</DialogContent></Dialog>
    </div>
  )
}
