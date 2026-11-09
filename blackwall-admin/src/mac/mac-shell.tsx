import { useEffect, useRef } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { ArrowLeft, Globe, PanelLeft, PanelRight, Search, Settings2 } from "lucide-react"
import { CategoryIcon } from "@/components/common/category-icon"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { CommandSearch } from "@/components/layout/command-search"
import { Notifications } from "@/components/layout/notifications"
import { QuickCreate } from "@/components/layout/quick-create"
import { SignIn } from "@/components/layout/sign-in"
import { SyncStatus, WorkspaceStatus } from "@/components/layout/workspace-status"
import { activeChild, isActive, useNav } from "@/components/layout/nav-config"
import { AssetFlowHost } from "@/features/assets/asset-flow"
import { FormHost } from "@/components/forms/form-host"
import { SettingsModal } from "@/features/settings/settings-modal"
import { useNow } from "@/hooks/use-now"
import { useConnections, useSession } from "@/services/connector"
import { useWorkspaceSync } from "@/services/workspace-sync"
import { usePageHead } from "@/stores/page-head"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { useDock } from "./dock/dock-store"
import { ToolDock } from "./dock/tool-dock"

/** Opens a browser tab in the Mac app (the workspace has no browser chrome of its own). */
const openBrowser = () => fetch("/__mac/shell/browser", { method: "POST", headers: { "X-Blackwall": "1" } }).catch(() => undefined)

/** The Mac renderer owns its navigation and window layout; feature pages share records and APIs. */
export function MacShell() {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const now = useNow()
  const nav = useNav()
  const destination = nav.find((item) => isActive(item, pathname))
  const currentChild = destination && activeChild(destination, pathname, search)
  const head = usePageHead()
  const retro = usePrefs((s) => s.retroDetails)
  const session = useSession((s) => s.state)
  const workspaceReady = useWorkspaceSync((s) => s.ready)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const openSettings = useUi((s) => s.openSettings)
  const navOpen = useDock((s) => s.navOpen)
  const dockOpen = useDock((s) => s.open)
  const toggleNav = useDock((s) => s.toggleNav)
  const toggleDock = useDock((s) => s.toggleDock)
  const mainRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const landing = usePrefs.getState().landingPage
    if (pathname === "/" && !search && !hash && landing !== "/") navigate(landing, { replace: true })
    // Landing preference applies only on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { void useSession.getState().check() }, [])
  useEffect(() => {
    if (session === "open") void useConnections.getState().refresh()
  }, [session])
  useEffect(() => { document.documentElement.dataset.retro = retro ? "on" : "off" }, [retro])
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [pathname])
  useEffect(() => {
    const element = headerRef.current
    if (!element) return
    const update = () => document.documentElement.style.setProperty("--bw-header-h", `${element.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [session])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault()
        useUi.getState().openSettings()
      }
      // As in VS Code: ⌘B hides the left sidebar, ⌥⌘B the right one.
      if (event.metaKey && !event.shiftKey && event.code === "KeyB") {
        event.preventDefault()
        if (event.altKey) useDock.getState().toggleDock()
        else useDock.getState().toggleNav()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (session === "checking" || session === "offline") return (
    <div className="mac-connection" role="status">
      <p>{session === "checking" ? "Connecting to Blackwall…" : "Connect to your Blackwall server to sign in."}</p>
      {session === "offline" && <Button size="sm" onClick={() => void useSession.getState().check()}>Reconnect</Button>}
    </div>
  )
  if (session === "signin") return <><SignIn /><Toaster position="bottom-right" /></>

  return (
    <TooltipProvider delayDuration={250}>
      <a href="#main" className="sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <div className="mac-shell">
        <header className="mac-titlebar" ref={headerRef}>
          <div className="mac-titlebar-lead">
            <button type="button" className="mac-tb-btn" onClick={toggleNav} aria-label={navOpen ? "Hide navigation" : "Show navigation"} aria-pressed={navOpen} title="Navigation"><PanelLeft size={15} /></button>
            {head.back && <Link className="mac-tb-btn" to={head.back.to} aria-label={`Back to ${head.back.label}`}><ArrowLeft size={15} /></Link>}
            <div className="mac-page-identity">
              <CategoryIcon category={destination?.category ?? "home"} />
              <div className="mac-page-title"><h1>{head.title ?? currentChild?.label ?? destination?.label ?? "Home"}</h1>{head.subtitle && <span>{head.subtitle}</span>}</div>
              {head.badge}
            </div>
          </div>
          <button className="mac-search" type="button" onClick={() => setSearchOpen(true)} aria-label="Search workspace"><Search size={14} /><span>Search Blackwall</span><kbd>⌘K</kbd></button>
          <div className="mac-titlebar-tail">
            {head.actions && <div className="mac-head-actions">{head.actions}</div>}
            <QuickCreate quiet />
            <Notifications />
            <button type="button" className="mac-tb-btn" onClick={() => void openBrowser()} aria-label="Open a browser tab" title="Browser (⌘T)"><Globe size={15} /></button>
            <button type="button" className="mac-tb-btn" onClick={toggleDock} aria-label={dockOpen ? "Hide tools" : "Show tools"} aria-pressed={dockOpen} title="Tools"><PanelRight size={15} /></button>
            <button type="button" className="mac-tb-btn" onClick={() => openSettings()} aria-label="Settings" title="Settings (⌘,)"><Settings2 size={15} /></button>
          </div>
        </header>

        <div className="mac-body">
          {navOpen && (
            <nav className="mac-navigator" aria-label="Workspace sections">
              <div className="mac-nav-tree">
                {nav.map((item) => {
                  const selected = isActive(item, pathname)
                  return <div className="mac-nav-group" key={item.id}>
                    <Link to={item.to} aria-current={selected && !currentChild ? "page" : undefined} className="mac-nav-parent" data-active={selected}><CategoryIcon category={item.category} /> <span>{item.label}</span></Link>
                    {selected && item.children && <div className="mac-nav-children">{item.children.map((child) => <Link key={child.to} to={child.to} aria-current={currentChild === child ? "page" : undefined} className="mac-nav-child">{child.label}</Link>)}</div>}
                  </div>
                })}
              </div>
            </nav>
          )}
          <main id="main" className="mac-main" ref={mainRef} tabIndex={-1} data-layout="responsive">
            <WorkspaceStatus connected />
            {workspaceReady && <Outlet />}
          </main>
          {workspaceReady && <ToolDock />}
        </div>

        <footer className="mac-statusbar">
          <SyncStatus />
          <span className="mac-status-item">{destination?.label ?? "Workspace"}{currentChild ? ` › ${currentChild.label}` : ""}</span>
          <span className="mac-tool-spacer" />
          <span className="mac-status-item">{format(now, "EEE, MMM d · h:mm a")}</span>
        </footer>
      </div>
      {workspaceReady && <><FormHost /><AssetFlowHost /><SettingsModal /><CommandSearch /></>}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
