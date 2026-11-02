import { useCallback, useEffect, useRef } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FormHost } from "@/components/forms/form-host"
import { CommandSearch } from "@/components/layout/command-search"
import { useConnections, useSession } from "@/services/connector"
import { WorkspaceStatus } from "./workspace-status"
import { useWorkspaceSync } from "@/services/workspace-sync"
import { Button } from "@/components/ui/button"
import { SignIn } from "./sign-in"
import { SettingsModal } from "@/features/settings/settings-modal"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { Header } from "./header"
import { MobileNav } from "./mobile-nav"
import { NavRail } from "./nav-rail"
import { useMobileView } from "./mobile/use-mobile-view"
import { MobileBoundary, MobileOutlet, MobileTabBar } from "./mobile/mobile-shell"

export function AppShell() {
  const retro = usePrefs((s) => s.retroDetails)
  const navExpanded = usePrefs((s) => s.navExpanded)
  const mainRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const mobileView = useMobileView()

  // Settings → General → Open on: only when the app first opens at its root, never when you click Home.
  useEffect(() => {
    const landing = usePrefs.getState().landingPage
    if (pathname === "/" && !search && !hash && landing !== "/") navigate(landing, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const focusMain = useCallback(() => mainRef.current?.focus({ preventScroll: true }), [])

  const workspaceReady = useWorkspaceSync((s) => s.ready)
  const session = useSession((s) => s.state)

  // Check sign-in first; then load connection statuses so panels know what's connected.
  useEffect(() => {
    void useSession.getState().check()
  }, [])
  useEffect(() => {
    if (session === "open") void useConnections.getState().refresh()
  }, [session])

  useEffect(() => {
    document.documentElement.dataset.retro = retro ? "on" : "off"
  }, [retro])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  // Floating cards (notifications) start just below the sticky header, whatever its height.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty("--bw-header-h", `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [session])

  // ⌘, (Ctrl+, elsewhere) opens settings, as in desktop apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault()
        useUi.getState().openSettings()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (session === "checking" || session === "offline") return (
    <div className="mx-auto max-w-sm space-y-3 p-6" role="status">
      <p>{session === "checking" ? "Connecting to Blackwall…" : "Connect to your Blackwall server to sign in."}</p>
      {session === "offline" && <Button onClick={() => void useSession.getState().check()}>Reconnect</Button>}
    </div>
  )

  if (session === "signin") {
    return (
      <>
        <SignIn />
        <Toaster position="bottom-right" />
      </>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <MobileNav />
      <div
        className={cn(
          "bw-app-shell px-3 transition-[padding] duration-200 ease-bw motion-reduce:transition-none",
          navExpanded ? "md:pl-[calc(var(--bw-tree-width)+24px)]" : "md:pl-[calc(var(--bw-rail-width)+24px)]",
        )}
      >
        <div ref={headerRef} className="bw-ground sticky top-0 z-30 py-3">
          <Header />
        </div>
        {/* Fixed on the left; after the header in tab order. */}
        {!mobileView && <NavRail focusMain={focusMain} />}
        <main id="main" ref={mainRef} tabIndex={-1} className={cn("bw-workspace outline-none", mobileView ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : "pb-3")} data-layout={mobileView ? "mobile" : "responsive"}>
          <WorkspaceStatus connected={session === "open"} />
          {workspaceReady && (mobileView
            ? <MobileBoundary key={pathname}><MobileOutlet /></MobileBoundary>
            : <Outlet />)}
        </main>
      </div>
      {mobileView && <MobileTabBar />}
      {workspaceReady && <><FormHost /><SettingsModal /><CommandSearch /></>}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
