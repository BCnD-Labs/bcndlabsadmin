import { format } from "date-fns"
import { Menu, Search } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { NAV, isActive } from "./nav-config"
import { CalendarMenu } from "./calendar-menu"
import { Notifications } from "./notifications"
import { QuickCreate } from "./quick-create"

function greeting(d: Date) {
  const h = d.getHours()
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 18 ? "Good afternoon" : "Good evening"
}

/** Where you are, from the nav tree: the destination and, if any, its matching sub-page. */
function crumbs(pathname: string, search: string): { label: string; to?: string }[] {
  const dest = NAV.find((d) => isActive(d, pathname))
  if (!dest) return [{ label: "blackwall" }]
  const child =
    dest.children?.find((c) => pathname + search === c.to) ??
    dest.children?.find((c) => !c.to.includes("?") && (pathname === c.to || pathname.startsWith(c.to + "/")))
  if (!child || dest.children?.length === 1) return [{ label: dest.label }]
  return [{ label: dest.label, to: dest.to }, { label: child.label }]
}

/** The page title lives on the page (PageHeader); the header shows where you are. */
function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-[0.6em] font-mono text-[13px] leading-[26px] text-muted-foreground">
        <li aria-hidden className="font-bold text-red">❯</li>
        {items.map((c, i) => (
          <li key={c.label} className="flex min-w-0 items-center gap-[0.6em]">
            {i > 0 && <span aria-hidden className="text-faint">/</span>}
            {c.to ? (
              <Link to={c.to} className="truncate lowercase hover:text-ink">{c.label}</Link>
            ) : (
              <span aria-current="page" className="truncate text-ink lowercase">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Spec §3 header: a panel-styled bar with the date line and greeting (or breadcrumb), search, + New, calendar and bell. */
export function Header() {
  const setMobileNavOpen = useUi((s) => s.setMobileNavOpen)
  const mobileNavOpen = useUi((s) => s.mobileNavOpen)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const workspaceName = usePrefs((s) => s.workspaceName).trim()
  const { pathname, search } = useLocation()
  const now = useNow()
  const home = pathname === "/"

  return (
    <header className="bw-panel z-20 flex flex-col gap-2.5 py-2.5 pr-2.5 pl-3 md:flex-row md:items-center md:justify-between md:gap-3 md:pl-4">
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
          <time className="bw-label truncate" dateTime={now.toISOString()} data-testid="header-clock">
            <span className="sm:hidden">{format(now, "EEE · MMM d · h:mm a")}</span>
            <span className="hidden sm:inline">{format(now, "EEEE · MMM d · h:mm a")}</span>
          </time>
          {home ? (
            <h1 className="truncate font-heading text-xl leading-[26px] font-bold sm:text-2xl">
              {greeting(now)}
              {workspaceName && `, ${workspaceName}`}
            </h1>
          ) : (
            <Breadcrumb items={crumbs(pathname, search)} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CalendarMenu />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
          aria-keyshortcuts="Meta+K"
          className="bw-well flex h-8 min-w-0 flex-1 items-center gap-2 px-2.5 text-left font-mono text-xs text-faint transition-colors hover:border-ledge-hi md:w-[220px] md:flex-none"
        >
          <Search className="size-[13px] shrink-0" strokeWidth={2} aria-hidden />
          <span className="flex-1">search</span>
          <kbd className="hidden rounded-[4px] border border-rim px-[5px] py-px font-mono text-[10px] text-faint sm:inline">⌘K</kbd>
        </button>
        <QuickCreate />
        <Notifications />
      </div>
    </header>
  )
}
