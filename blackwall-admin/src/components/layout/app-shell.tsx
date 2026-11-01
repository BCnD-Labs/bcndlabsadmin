import { useCallback, useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FormHost } from "@/components/forms/form-host"
import { CommandSearch } from "@/components/layout/command-search"
import { useConnections, useSession } from "@/services/connector"
import { SignIn } from "./sign-in"
import { SettingsModal } from "@/features/settings/settings-modal"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { Header } from "./header"
import { MobileNav } from "./mobile-nav"
import { NavRail } from "./nav-rail"

export function AppShell() {
  const retro = usePrefs((s) => s.retroDetails)
  const navExpanded = usePrefs((s) => s.navExpanded)
  const mainRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  const focusMain = useCallback(() => mainRef.current?.focus({ preventScroll: true }), [])

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
          "px-3 transition-[padding] duration-200 ease-bw motion-reduce:transition-none",
          navExpanded ? "md:pl-[244px]" : "md:pl-[84px]",
        )}
      >
        <div ref={headerRef} className="bw-ground sticky top-0 z-30 py-3">
          <Header />
        </div>
        {/* Fixed on the left; after the header in tab order. */}
        <NavRail focusMain={focusMain} />
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-[1600px] pb-3 outline-none">
          <Outlet />
        </main>
      </div>
      <FormHost />
      <SettingsModal />
      <CommandSearch />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
