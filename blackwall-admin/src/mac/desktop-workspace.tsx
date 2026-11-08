import { memo, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useRoutes } from "react-router-dom"
import { format } from "date-fns"
import { toast } from "sonner"
import { createStore, useStore, type StoreApi } from "zustand"
import { BarChart3, BookOpen, CalendarDays, Code2, FileText, Folder, Globe, GraduationCap, Home, LayoutDashboard, Maximize2, Pin, Search, Server, Settings2, Share2, X } from "lucide-react"
import { blackwallPages } from "@/app-routes"
import { QuickCreate } from "@/components/layout/quick-create"
import { Notifications } from "@/components/layout/notifications"
import { SyncStatus, WorkspaceStatus } from "@/components/layout/workspace-status"
import { useNow } from "@/hooks/use-now"
import { useWorkspaceSync } from "@/services/workspace-sync"
import { PageHeadStoreContext, type PageHead } from "@/stores/page-head"
import { useUi } from "@/stores/ui"
import { NotesTool } from "./dock/tools"
import { PlannerSidebar } from "./planner-sidebar"
import { todayKey } from "@/lib/dates"
import { useWorkspace } from "@/stores/workspace"
import { moveAroundLocked, overlaps, placeOutsideLocked, resizeAroundLocked, type WindowRect } from "./window-geometry"
import "./desktop-workspace.css"

const APP = {
  home: { title: "Home", route: "/", icon: Home, tone: "neutral" },
  planner_app: { title: "Planner", route: "/productivity", icon: CalendarDays, tone: "productivity" },
  journal: { title: "Journal", route: "/journal", icon: BookOpen, tone: "learning" },
  learning: { title: "Learning", route: "/productivity/learning", icon: GraduationCap, tone: "learning" },
  projects: { title: "Projects", route: "/productivity/projects", icon: Folder, tone: "projects" },
  insights: { title: "Insights", route: "/productivity/insights", icon: BarChart3, tone: "insights" },
  development: { title: "GitHub activity", route: "/development", icon: Code2, tone: "github" },
  website: { title: "Website", route: "/cms", icon: Globe, tone: "website" },
  social: { title: "Social", route: "/social", icon: Share2, tone: "neutral" },
  mikoshi: { title: "Mikoshi", route: "/mikoshi", icon: Server, tone: "neutral" },
  settings: { title: "Settings", route: "/settings", icon: Settings2, tone: "neutral" },
} as const
type AppId = keyof typeof APP
type Id = "notes" | AppId
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"
type WindowState = WindowRect & { open: boolean; collapsed: boolean; expanded: boolean; pinned: boolean; z: number; path?: string; restore?: WindowRect }
type Windows = Record<Id, WindowState>
type Gesture = { id: Id; pointer: number; startX: number; startY: number; lastX: number; lastY: number; start: WindowRect; current: WindowRect; edge?: Edge }
const EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]
const APP_IDS = Object.keys(APP) as AppId[]
const IDS: Id[] = ["notes", ...APP_IDS]
const RAIL_IDS: Id[] = ["home", "learning", "journal", "notes", "projects", "insights", "development", "website", "social", "mikoshi"]
const KEY = "blackwall-mac-desktop-windows-v2"
const isWidget = (id: Id): id is "notes" => id === "notes"
function appForPath(path: string): AppId {
  if (path.startsWith("/journal")) return "journal"
  if (path.startsWith("/productivity/learning")) return "learning"
  if (path.startsWith("/productivity/projects")) return "projects"
  if (path.startsWith("/work/projects")) return "projects"
  if (path.startsWith("/productivity/insights") || path === "/analytics") return "insights"
  if (path.startsWith("/productivity") || path.startsWith("/work") || path.startsWith("/notes") || path.startsWith("/knowledge")) return "planner_app"
  if (path.startsWith("/development")) return "development"
  if (path.startsWith("/cms") || path.startsWith("/content")) return "website"
  if (path.startsWith("/social")) return "social"
  if (path.startsWith("/mikoshi")) return "mikoshi"
  if (path.startsWith("/settings")) return "settings"
  return "home"
}
const visibleRect = (value: WindowState): WindowRect => ({ x: value.x, y: value.y, width: value.width, height: value.collapsed ? 30 : value.height })
const openBrowser = () => fetch("/__mac/shell/browser", { method: "POST", headers: { "X-Blackwall": "1" } }).catch(() => undefined)
const LiveNotes = memo(NotesTool)

function initialWindows(): Windows {
  const width = window.innerWidth, height = window.innerHeight
  const defaults = {
    notes: { x: Math.max(80, Math.round(width * .12)), y: Math.min(height - 44, 680), width: Math.min(360, width - 95), height: 280, open: true, collapsed: true, expanded: false, pinned: false, z: 1 },
    ...Object.fromEntries(APP_IDS.map((id, index) => [id, { x: Math.max(75, Math.round(width * .12) + index * 28), y: Math.max(60, Math.round(height * .08) + index * 22), width: Math.min(id === "planner_app" || id === "learning" ? 1000 : 820, width - 105), height: Math.min(id === "planner_app" || id === "learning" ? 650 : 560, height - 90), open: false, collapsed: false, expanded: false, pinned: false, z: index + 3, path: APP[id].route }])),
  } as Windows
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem("blackwall-mac-desktop-windows-v1") ?? "null") as Partial<Record<Id | "app", Partial<WindowState>>> | null
    if (!saved || typeof saved !== "object") return defaults
    const migratedApp = appForPath(window.location.pathname)
    for (const id of IDS) {
      const value = saved[id] ?? (id === migratedApp ? saved.app : undefined)
      if (!value || [value.x, value.y, value.width, value.height].some(n => typeof n !== "number" || !Number.isFinite(n))) continue
      defaults[id] = { ...defaults[id], x: Math.max(45, Math.min(width - 100, value.x!)), y: Math.max(42, Math.min(height - 32, value.y!)), width: Math.max(280, Math.min(width - 50, value.width!)), height: Math.max(200, Math.min(height - 50, value.height!)), open: value.open !== false, collapsed: isWidget(id) && value.collapsed === true, pinned: isWidget(id) && value.pinned === true, expanded: false, path: !isWidget(id) && typeof value.path === "string" && value.path.startsWith("/") ? value.path : id === migratedApp && saved.app ? window.location.pathname + window.location.search : defaults[id].path }
    }
  } catch { /* Use a fresh local layout when storage is unavailable. */ }
  return defaults
}

function WindowTitle({ store, fallback }: { store: StoreApi<PageHead>; fallback: string }) {
  const title = useStore(store, state => state.title)
  return <>{title ?? fallback}</>
}

function AppToolbar({ store }: { store: StoreApi<PageHead> }) {
  const head = useStore(store)
  return <div className="mac-dw-app-toolbar">{head.back && <Link to={head.back.to}>← {head.back.label}</Link>}{head.subtitle && <span>{head.subtitle}</span>}{head.actions && <div className="mac-dw-actions">{head.actions}</div>}</div>
}

const AppPage = memo(function AppPage({ path, store }: { path: string; store: StoreApi<PageHead> }) {
  const page = useRoutes(blackwallPages, path)
  return <PageHeadStoreContext.Provider value={store}>
    <AppToolbar store={store} />
    <main className="mac-dw-app-main" tabIndex={-1}>{page}</main>
  </PageHeadStoreContext.Provider>
})

export function DesktopWorkspace({ onClassic }: { onClassic: () => void }) {
  const [windows, setWindows] = useState(initialWindows)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const layer = useRef(Math.max(...IDS.map(id => windows[id].z)))
  const [appStores] = useState(() => Object.fromEntries(APP_IDS.map(id => [id, createStore<PageHead>()(() => ({}))])) as Record<AppId, StoreApi<PageHead>>)
  const { pathname, search, key: routeKey } = useLocation()
  const priorPath = useRef(pathname)
  const navigate = useNavigate()
  const now = useNow()
  const overdue = useWorkspace(s => s.tasks.filter(t => !t.done && t.kind !== "event" && t.due && t.due < todayKey()).length)
  const ready = useWorkspaceSync(s => s.ready)
  const setSearchOpen = useUi(s => s.setSearchOpen)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(windows)) } catch { /* Layout remains usable this session. */ } }, [windows])
  useEffect(() => {
    const id = appForPath(pathname)
    const changed = priorPath.current !== pathname
    priorPath.current = pathname
    if (pathname === "/" && !changed) return
    const path = pathname + search
    setWindows(all => ({ ...all, [id]: { ...all[id], path, open: true, z: ++layer.current } }))
  }, [pathname, search, routeKey])
  useEffect(() => { document.documentElement.style.setProperty("--bw-header-h", "42px") }, [])
  useEffect(() => { if (!plannerOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPlannerOpen(false) }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close) }, [plannerOpen])

  const update = (id: Id, fn: (value: WindowState) => WindowState) => setWindows(all => ({ ...all, [id]: fn(all[id]) }))
  const focus = (id: Id) => { const z = ++layer.current; update(id, value => ({ ...value, z })) }
  const open = (id: Id) => {
    const value = windows[id]
    const blockers = isWidget(id) ? locked(id) : []
    const visible = visibleRect(value)
    const position = blockers.some(blocker => overlaps(visible, blocker))
      ? placeOutsideLocked(visible, blockers, { width: window.innerWidth, height: window.innerHeight }) : visible
    if (!position) { toast.error("No clear desktop space for this widget. Move or collapse a pinned widget first."); return }
    const z = ++layer.current
    update(id, current => ({ ...current, x: position.x, y: position.y, open: true, z }))
  }
  const launch = (id: AppId) => {
    open(id)
    navigate(windows[id].path ?? APP[id].route)
  }
  const locked = (id: Id) => IDS.filter(other => isWidget(other) && other !== (id as Id) && windows[other].open && windows[other].pinned).map(other => visibleRect(windows[other]))
  const pin = (id: Id) => update(id, value => {
    if (value.pinned) return { ...value, pinned: false }
    return IDS.some(other => isWidget(other) && other !== (id as Id) && windows[other].open && overlaps(visibleRect(value), visibleRect(windows[other]))) ? value : { ...value, pinned: true }
  })
  const expand = (id: Id) => update(id, value => {
    if (value.expanded && value.restore) return { ...value, ...value.restore, expanded: false, restore: undefined }
    const next = { x: 51, y: 45, width: window.innerWidth - 60, height: window.innerHeight - 55 }
    const occupied = isWidget(id) ? value.pinned ? IDS.filter(other => isWidget(other) && other !== (id as Id) && windows[other].open).map(other => visibleRect(windows[other])) : locked(id) : []
    if (occupied.some(other => overlaps(next, other))) return value
    return { ...value, ...next, restore: value, expanded: true, collapsed: false }
  })

  const start = (event: PointerEvent<HTMLElement>, id: Id, edge?: Edge) => {
    if (event.button !== 0 || (!edge && (event.target as Element).closest("button, a"))) return
    const value = windows[id]
    if (value.pinned && (!edge || edge.includes("n") || edge.includes("w"))) return
    gesture.current = { id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, start: value, current: value, edge }
    event.currentTarget.setPointerCapture(event.pointerId)
    focus(id)
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (!g || g.pointer !== event.pointerId) return
    const blockers = isWidget(g.id) ? windows[g.id].pinned ? IDS.filter(other => other !== g.id && isWidget(other) && windows[other].open).map(other => visibleRect(windows[other])) : locked(g.id) : []
    let next: WindowRect
    if (!g.edge) next = moveAroundLocked(g.current, event.clientX - g.lastX, event.clientY - g.lastY, blockers)
    else {
      const dx = event.clientX - g.startX, dy = event.clientY - g.startY
      let { x, y, width, height } = g.start
      if (g.edge.includes("e")) width += dx
      if (g.edge.includes("s")) height += dy
      if (g.edge.includes("w")) { x += dx; width -= dx }
      if (g.edge.includes("n")) { y += dy; height -= dy }
      const minW = isWidget(g.id) ? 280 : 480
      const minH = 200
      if (width < minW) { if (g.edge.includes("w")) x -= minW - width; width = minW }
      if (height < minH) { if (g.edge.includes("n")) y -= minH - height; height = minH }
      next = resizeAroundLocked(g.current, { x, y, width, height }, blockers)
    }
    next = { ...next, x: Math.max(44, Math.min(window.innerWidth - 100, next.x)), y: Math.max(40, Math.min(window.innerHeight - 30, next.y)) }
    g.current = next
    g.lastX = event.clientX; g.lastY = event.clientY
    update(g.id, value => ({ ...value, ...next, expanded: false }))
  }
  const end = (event: PointerEvent<HTMLElement>) => {
    if (gesture.current?.pointer === event.pointerId) gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const frame = (id: Id, title: ReactNode, icon: ReactNode, children: ReactNode) => {
    const value = windows[id]
    if (!value.open) return null
    const pinBlocked = isWidget(id) && !value.pinned && IDS.some(other => isWidget(other) && other !== (id as Id) && windows[other].open && overlaps(visibleRect(value), visibleRect(windows[other])))
    const widgetFront = windows.notes.z
    const appRank = APP_IDS.filter(app => windows[app].open).sort((a, b) => windows[a].z - windows[b].z).indexOf(id as AppId)
    return <section key={id} className="mac-dw-window" data-kind={isWidget(id) ? "widget" : "app"} data-tone={isWidget(id) ? "productivity" : APP[id].tone} data-collapsed={value.collapsed} aria-label={`${isWidget(id) ? id : APP[id].title} window`}
      style={{ left: value.x, top: value.y, width: value.width, height: value.collapsed ? 30 : value.height, zIndex: isWidget(id) ? value.z === widgetFront ? 11 : 10 : 20 + appRank }} onPointerDown={event => { if (!(event.target as Element).closest(".mac-dw-title, .mac-dw-edge")) focus(id) }}>
      <header className="mac-dw-title" onPointerDown={event => start(event, id)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDoubleClick={() => isWidget(id) && update(id, current => ({ ...current, collapsed: !current.collapsed }))}>
        <span className="mac-dw-icon">{icon}</span><strong>{title}</strong><span className="mac-dw-spacer" />
        {isWidget(id) && <button type="button" aria-label={value.pinned ? `Unlock ${id} position` : `Lock ${id} position`} title={pinBlocked ? "Move clear of other widgets to lock" : undefined} aria-pressed={value.pinned} disabled={pinBlocked} onClick={() => pin(id)}><Pin size={15} fill={value.pinned ? "currentColor" : "none"} /></button>}
        <button type="button" aria-label={value.expanded ? `Restore ${id} window` : `Expand ${id} window`} onClick={() => expand(id)}><Maximize2 size={15} /></button>
        <button type="button" aria-label={`Close ${id} window`} onClick={() => update(id, current => ({ ...current, open: false }))}><X size={17} /></button>
      </header>
      {!value.collapsed && <div className="mac-dw-content">{children}</div>}
      {EDGES.map(edge => <span key={edge} className={`mac-dw-edge edge-${edge}`} onPointerDown={event => start(event, id, edge)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />)}
    </section>
  }

  return <div id="main" className="mac-dw-desktop" tabIndex={-1}>
    <WorkspaceStatus connected />
    <div className="mac-dw-dragbar" aria-hidden />
    <nav className="mac-dw-rail" aria-label="Blackwall apps and tools">
      <span className="mac-dw-mark">BW</span>
      {RAIL_IDS.map(id => {
        const widget = isWidget(id)
        const label = widget ? "Notes widget" : APP[id].title
        const Icon = widget ? FileText : APP[id].icon
        return <button key={id} data-tone={widget ? "productivity" : APP[id].tone} title={label} aria-label={`Open ${label}`} aria-pressed={windows[id].open} onClick={() => widget ? open(id) : launch(id)}><Icon size={16} /></button>
      })}
      <span className="mac-dw-flex" />
      <button title="Classic workspace (⌥⌘D)" aria-label="Open classic workspace" onClick={onClassic}><LayoutDashboard size={16} /></button>
      <SyncStatus />
      <button title="Settings" aria-label="Open Settings" aria-pressed={windows.settings.open} onClick={() => launch("settings")}><Settings2 size={16} /></button>
    </nav>
    <div className="mac-dw-top">
      <QuickCreate quiet /><Notifications ntfyOnly />
      <button title="Search" aria-label="Search workspace" onClick={() => setSearchOpen(true)}><Search size={15} /></button>
      <button title="Browser" aria-label="Open browser tab" onClick={() => void openBrowser()}><Globe size={15} /></button>
      <button type="button" className="mac-dw-date" aria-label={overdue ? `Planner, ${overdue} overdue tasks` : "Open Planner"} aria-expanded={plannerOpen} onClick={() => setPlannerOpen(value => !value)}><CalendarDays size={14} />{format(now, "EEE, MMM d")}{overdue > 0 && <span className="mac-dw-overdue-dot" aria-hidden />}</button><time>{format(now, "h:mm a")}</time>
    </div>
    {ready && <>
      {frame("notes", "Notes", <FileText size={16} />, <LiveNotes />)}
      {APP_IDS.map(id => {
        const Icon = APP[id].icon
        return frame(id, <WindowTitle store={appStores[id]} fallback={APP[id].title} />, <Icon size={16} />, <AppPage path={windows[id].path ?? APP[id].route} store={appStores[id]} />)
      })}
    </>}
    {ready && plannerOpen && <PlannerSidebar overdue={overdue} onClose={() => setPlannerOpen(false)} onExpand={() => { setPlannerOpen(false); launch("planner_app") }} />}
  </div>
}
