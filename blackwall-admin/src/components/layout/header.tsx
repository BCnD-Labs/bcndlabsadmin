import { Menu, Search } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { QuickCreate } from "./quick-create"

export function Header() {
  const setMobileNavOpen = useUi((s) => s.setMobileNavOpen)
  const mobileNavOpen = useUi((s) => s.mobileNavOpen)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const workspaceName = usePrefs((s) => s.workspaceName)

  return (
    <header className="retro-scanlines sticky top-0 z-30 flex h-14 items-center gap-2 border-b-2 border-edge bg-recessed/95 px-3 shadow-[0_4px_0_0_#000] backdrop-blur supports-backdrop-filter:bg-recessed/90">
      {/* Small screens only; desktop has the always-visible icon strip. */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        aria-expanded={mobileNavOpen}
        aria-controls="mobile-nav"
        onClick={() => setMobileNavOpen(true)}
        className="size-9 md:hidden"
      >
        <Menu className="size-5" />
      </Button>

      <Link
        to="/"
        className="flex items-baseline gap-2 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="wordmark text-[2rem] text-teal">Blackwall</span>
        {workspaceName && (
          <span className="hidden font-mono text-[0.68rem] tracking-wider text-muted-foreground uppercase sm:inline">
            {workspaceName}
          </span>
        )}
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setSearchOpen(true)}
          className="h-9 w-9 justify-start gap-2 px-2 font-sans font-normal text-muted-foreground sm:w-56 lg:w-72"
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
