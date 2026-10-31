import { format } from "date-fns"
import { Menu, Search } from "lucide-react"
import { useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { NAV, isActive } from "./nav-config"
import { CalendarMenu } from "./calendar-menu"
import { QuickCreate } from "./quick-create"

function greeting(d: Date) {
  const h = d.getHours()
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 18 ? "Good afternoon" : "Good evening"
}

/** The page's name from the nav tree: the matching sub-page, else its section. */
function pageTitle(pathname: string, search: string) {
  const dest = NAV.find((d) => isActive(d, pathname))
  if (!dest) return "Blackwall"
  const child =
    dest.children?.find((c) => pathname + search === c.to) ??
    dest.children?.find((c) => !c.to.includes("?") && (pathname === c.to || pathname.startsWith(c.to + "/")))
  return child?.label ?? dest.label
}

/** Spec §3 header: a panel-styled bar with the date line and greeting, search, + New, calendar and bell. */
export function Header() {
  const setMobileNavOpen = useUi((s) => s.setMobileNavOpen)
  const mobileNavOpen = useUi((s) => s.mobileNavOpen)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const workspaceName = usePrefs((s) => s.workspaceName).trim()
  const { pathname, search } = useLocation()
  const now = useNow()
  const home = pathname === "/"

  return (
    <header className="bw-panel z-20 flex flex-wrap items-center justify-between gap-3 py-2.5 pr-2.5 pl-4">
      <div className="flex min-w-0 items-center gap-2">
        {/* Small screens only; desktop has the rail. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileNavOpen(true)}
          className="md:hidden"
        >
          <Menu />
        </Button>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <time className="eyebrow" dateTime={now.toISOString()} data-testid="header-clock">
            {format(now, "EEEE · MMM d · h:mm a")}
          </time>
          {home ? (
            <h1 className="truncate font-heading text-2xl leading-[1.1] font-bold">
              {greeting(now)}
              {workspaceName && `, ${workspaceName}`}
            </h1>
          ) : (
            <p className="truncate font-heading text-2xl leading-[1.1] font-bold">{pageTitle(pathname, search)}</p>
          )}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
          aria-keyshortcuts="Meta+K"
          className="bw-well flex h-8 w-[220px] max-w-full items-center gap-2 px-2.5 text-left font-mono text-xs text-faint transition-colors hover:border-ledge-hi"
        >
          <Search className="size-[13px] shrink-0" strokeWidth={2} aria-hidden />
          <span className="flex-1">search</span>
          <kbd className="rounded-[4px] border border-rim px-[5px] py-px font-mono text-[10px] text-faint">⌘K</kbd>
        </button>
        <QuickCreate />
        <CalendarMenu />
      </div>
    </header>
  )
}
