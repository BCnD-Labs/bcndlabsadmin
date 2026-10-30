import { Menu, Search } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { useIsDesktop } from "@/hooks/use-media-query"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { QuickCreate } from "./quick-create"

export function Header() {
  const isDesktop = useIsDesktop()
  const railOpen = useUi((s) => s.railOpen)
  const pinned = usePrefs((s) => s.railPinned)
  const setRailOpen = useUi((s) => s.setRailOpen)
  const requestRailFocus = useUi((s) => s.requestRailFocus)
  const setMobileNavOpen = useUi((s) => s.setMobileNavOpen)
  const mobileNavOpen = useUi((s) => s.mobileNavOpen)
  const setMenuButton = useUi((s) => s.setMenuButton)
  const setSearchOpen = useUi((s) => s.setSearchOpen)

  const expanded = isDesktop ? railOpen || pinned : mobileNavOpen

  const onMenu = () => {
    if (!isDesktop) return setMobileNavOpen(true)
    if (railOpen && !pinned) setRailOpen(false)
    else requestRailFocus()
  }

  return (
    <header className="raised-edge retro-scanlines sticky top-0 z-30 flex h-13 items-center gap-2 border-b bg-recessed/95 px-3 backdrop-blur supports-backdrop-filter:bg-recessed/85">
      <Button
        ref={setMenuButton}
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        aria-expanded={expanded}
        aria-controls={isDesktop ? undefined : "mobile-nav"}
        onClick={onMenu}
        className="size-9"
      >
        <Menu className="size-5" />
      </Button>

      <Link
        to="/"
        className="flex items-baseline gap-2 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="wordmark text-[1.7rem] text-foreground">Blackwall</span>
        <span className="hidden font-mono text-[0.68rem] tracking-wider text-muted-foreground uppercase sm:inline">
          bcndlabs
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setSearchOpen(true)}
          className="h-8 w-9 justify-start gap-2 border-input/60 bg-background/60 px-2 text-muted-foreground sm:w-56 lg:w-72"
          aria-label="Search workspace"
        >
          <Search className="size-4" />
          <span className="hidden flex-1 text-left sm:inline">Search workspace…</span>
          <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
        </Button>
        <QuickCreate />
      </div>
    </header>
  )
}
