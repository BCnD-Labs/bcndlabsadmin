import { useEffect, useRef } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { ArrowLeft, Search, Settings2 } from "lucide-react"
import { CategoryIcon } from "@/components/common/category-icon"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { CalendarMenu } from "@/components/layout/calendar-menu"
import { CommandSearch } from "@/components/layout/command-search"
import { Notifications } from "@/components/layout/notifications"
import { QuickCreate } from "@/components/layout/quick-create"
import { SignIn } from "@/components/layout/sign-in"
import { SyncStatus, WorkspaceStatus } from "@/components/layout/workspace-status"
import { activeChild, isActive, useNav } from "@/components/layout/nav-config"
import { FormHost } from "@/components/forms/form-host"
import { SettingsModal } from "@/features/settings/settings-modal"
import { useNow } from "@/hooks/use-now"
import { useConnections, useSession } from "@/services/connector"
import { useWorkspaceSync } from "@/services/workspace-sync"
import { usePageHead } from "@/stores/page-head"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"

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
        <nav className="mac-rail" aria-label="Primary navigation">
          <Link className="mac-mark" to="/" aria-label="Blackwall home">BW</Link>
          <div className="mac-rail-items">
            {nav.map((item) => <Link key={item.id} to={item.to} title={item.label} aria-label={item.label} aria-current={isActive(item, pathname) ? "page" : undefined} className="mac-rail-link"><CategoryIcon category={item.category} /></Link>)}
          </div>
          <div className="mac-rail-bottom"><SyncStatus /><button type="button" className="mac-rail-settings" onClick={() => openSettings()} aria-label="Settings" title="Settings"><Settings2 size={17} /></button></div>
        </nav>

        <nav className="mac-navigator" aria-label="Workspace sections">
          <div className="mac-navigator-head"><span>BLACKWALL</span><strong>Workspace</strong></div>
          <div className="mac-nav-tree">
            {nav.map((item) => {
              const selected = isActive(item, pathname)
              return <div className="mac-nav-group" key={item.id}>
                <Link to={item.to} aria-current={selected && !currentChild ? "page" : undefined} className="mac-nav-parent" data-active={selected}><CategoryIcon category={item.category} /> <span>{item.label}</span></Link>
                {selected && item.children && <div className="mac-nav-children">{item.children.map((child) => <Link key={child.to} to={child.to} aria-current={currentChild === child ? "page" : undefined} className="mac-nav-child">{child.label}</Link>)}</div>}
              </div>
            })}
          </div>
          <div className="mac-navigator-foot"><span>LOCAL WORKSPACE</span><span>{format(now, "EEE · MMM d")}</span></div>
        </nav>

        <div className="mac-stage">
          <div className="mac-stage-header" ref={headerRef}>
            <div className="mac-command-bar">
              <div className="mac-breadcrumb"><span>BLACKWALL</span><span className="mac-breadcrumb-divider">/</span><span>{destination?.label ?? "Workspace"}</span>{currentChild && <><span className="mac-breadcrumb-divider">/</span><span>{currentChild.label}</span></>}</div>
              <div className="mac-command-actions"><CalendarMenu /><button className="mac-search" type="button" onClick={() => setSearchOpen(true)} aria-label="Search workspace"><Search size={14} /><span>Search</span><kbd>⌘K</kbd></button><QuickCreate quiet /><Notifications /></div>
            </div>
            <div className="mac-page-bar">
              <div className="mac-page-identity">
                {head.back && <Link className="mac-back" to={head.back.to} aria-label={`Back to ${head.back.label}`}><ArrowLeft size={15} /></Link>}
                <CategoryIcon category={destination?.category ?? "home"} />
                <div className="mac-page-title"><h1>{head.title ?? currentChild?.label ?? destination?.label ?? "Home"}</h1>{head.subtitle && <span>{head.subtitle}</span>}</div>
                {head.badge}
              </div>
              {head.actions && <div className="mac-head-actions">{head.actions}</div>}
            </div>
          </div>
          <main id="main" className="mac-main" ref={mainRef} tabIndex={-1} data-layout="responsive">
            <WorkspaceStatus connected />
            {workspaceReady && <Outlet />}
          </main>
        </div>
      </div>
      {workspaceReady && <><FormHost /><SettingsModal /><CommandSearch /></>}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
