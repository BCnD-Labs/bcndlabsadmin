import { useCallback, useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FormHost } from "@/components/forms/form-host"
import { CommandSearch } from "@/components/layout/command-search"
import { useConnections, useSession } from "@/services/connector"
import { SignIn } from "./sign-in"
import { usePrefs } from "@/stores/prefs"
import { Header } from "./header"
import { MobileNav } from "./mobile-nav"
import { NavRail } from "./nav-rail"

export function AppShell() {
  const retro = usePrefs((s) => s.retroDetails)
  const mainRef = useRef<HTMLElement>(null)
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
      <div className="px-3 md:pl-[84px]">
        <div className="bw-ground sticky top-0 z-30 py-3">
          <Header />
        </div>
        {/* Fixed on the left; after the header in tab order. */}
        <NavRail focusMain={focusMain} />
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-[1600px] pb-3 outline-none">
          <Outlet />
        </main>
      </div>
      <FormHost />
      <CommandSearch />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
