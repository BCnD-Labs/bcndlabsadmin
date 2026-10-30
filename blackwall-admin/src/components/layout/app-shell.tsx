import { useCallback, useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FormHost } from "@/components/forms/form-host"
import { CommandSearch } from "@/components/layout/command-search"
import { useConnections } from "@/services/connector"
import { usePrefs } from "@/stores/prefs"
import { Header } from "./header"
import { MobileNav } from "./mobile-nav"
import { NavRail } from "./nav-rail"

export function AppShell() {
  const retro = usePrefs((s) => s.retroDetails)
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  const focusMain = useCallback(() => mainRef.current?.focus({ preventScroll: true }), [])

  // Load connection statuses once so panels know what's connected.
  useEffect(() => {
    useConnections.getState().refresh()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.retro = retro ? "on" : "off"
  }, [retro])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Header />
      <NavRail focusMain={focusMain} />
      <MobileNav />
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-[1600px] px-3 py-4 outline-none sm:px-4 md:pl-[4.75rem] lg:pr-6 lg:pl-20"
      >
        <Outlet />
      </main>
      <FormHost />
      <CommandSearch />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
