import { format } from "date-fns"
import { ArrowLeft, Menu, Search } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { usePageHead } from "@/stores/page-head"
import { useNav, isActive } from "./nav-config"
import { SectionNav } from "./section-nav"
import { SyncStatus } from "./workspace-status"
import { CalendarMenu } from "./calendar-menu"
import { Notifications } from "./notifications"
import { QuickCreate } from "./quick-create"

function greeting(d: Date) {
  const h = d.getHours()
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 18 ? "Good afternoon" : "Good evening"
}

/** Application header: greeting (Home) or the page title with its section tabs, then search, + New, calendar and bell. */
export function Header() {
  const setMobileNavOpen = useUi((s) => s.setMobileNavOpen)
  const mobileNavOpen = useUi((s) => s.mobileNavOpen)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const workspaceName = usePrefs((s) => s.workspaceName).trim()
  const { pathname } = useLocation()
  const now = useNow()
  const home = pathname === "/"
  const head = usePageHead()
  const nav = useNav(true)
  const dest = nav.find((d) => isActive(d, pathname))
  const hasTabs = !!dest?.children?.length && !(dest.children.length === 1)

  return (
    <header className="bw-app-header bw-workspace mx-auto z-20 flex w-full  flex-col gap-2.5 border-b border-line-soft py-2 pr-0 pl-0 md:flex-row md:items-center md:justify-between md:gap-3">
      <div className="flex min-w-0 items-center gap-2 md:flex-1">
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
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {home ? (
            <>
              <time className="bw-label truncate leading-4" dateTime={now.toISOString()} data-testid="header-clock">
                <span className="sm:hidden">{format(now, "EEE · MMM d · h:mm a")}</span>
                <span className="hidden sm:inline">{format(now, "EEEE · MMM d · h:mm a")}</span>
              </time>
              <h1 className="truncate font-heading text-xl leading-[26px] font-bold sm:text-2xl">
                {greeting(now)}
                {workspaceName && `, ${workspaceName}`}
              </h1>
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2">
                {head.back && (
                  <Button variant="quiet" size="icon-sm" asChild className="-ml-1.5 shrink-0">
                    <Link to={head.back.to} aria-label={`Back to ${head.back.label}`} title={`Back to ${head.back.label}`}><ArrowLeft /></Link>
                  </Button>
                )}
                <h1 className="min-w-0 truncate font-heading text-xl leading-[26px] font-bold sm:text-[22px]">{head.title ?? dest?.label}</h1>
                <span className="flex shrink-0 items-center gap-2">{head.badge}</span>
                {head.subtitle && <span className="hidden min-w-0 truncate text-xs text-muted-foreground 2xl:inline">{head.subtitle}</span>}
              </div>
              {hasTabs && <SectionNav inHeader />}
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {head.actions && <div className="mr-1 hidden items-center gap-2 border-r border-line-soft pr-3 md:flex">{head.actions}</div>}
        <CalendarMenu />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
          aria-keyshortcuts="Meta+K"
          className={`bw-well flex h-8 min-w-0 flex-1 items-center gap-2 px-2.5 text-left text-[13px] text-faint transition-colors hover:border-ledge-hi md:size-8 md:flex-none md:justify-center md:px-0 ${head.actions ? "xl:w-[160px] xl:justify-start xl:px-2.5 2xl:w-[220px]" : "lg:w-[160px] lg:justify-start lg:px-2.5 xl:w-[220px]"}`}
        >
          <Search className="size-[13px] shrink-0" strokeWidth={2} aria-hidden />
          <span className={`flex-1 md:hidden ${head.actions ? "xl:inline" : "lg:inline"}`}>search</span>
          <kbd className={`hidden rounded-[4px] border border-b-2 border-rim bg-raised px-[5px] py-px font-mono text-[10px] text-muted-foreground sm:inline md:hidden ${head.actions ? "xl:inline" : "lg:inline"}`}>⌘K</kbd>
        </button>
        <QuickCreate quiet />
        <Notifications />
        {/* The rail carries the save status; phones (no rail) show it here. */}
        <span className="md:hidden"><SyncStatus /></span>
      </div>
    </header>
  )
}
