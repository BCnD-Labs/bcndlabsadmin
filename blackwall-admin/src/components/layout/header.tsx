import { timeFmt } from "@/lib/dates"
import { format } from "date-fns"
import { useLayoutEffect, useState } from "react"
import { ArrowLeft, Menu, Search } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { useIsDesktop } from "@/hooks/use-media-query"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { usePageHead } from "@/stores/page-head"
import { useNav, activeIn } from "./nav-config"
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
  const dest = activeIn(nav, pathname)
  const hasTabs = !!dest?.children?.length && !(dest.children.length === 1)
  const [titleEl, setTitleEl] = useState<HTMLDivElement | null>(null)
  const [tabsEl, setTabsEl] = useState<HTMLElement | null>(null)
  const tabsOverflow = useTabsOverflow(titleEl, tabsEl, dest?.children?.map((c) => c.label).join("|") ?? "")
  // Tabs sit under the title beside the actions when they fit; otherwise (and on phones) they
  // get their own full-width row below the title and actions, wrapping instead of scrolling.
  const tabsBelow = !useIsDesktop() || tabsOverflow

  return (
    <header
      data-tabs={hasTabs ? (tabsBelow ? "below" : "inline") : undefined}
      className="bw-app-header bw-workspace mx-auto z-20 flex w-full flex-col gap-2.5 border-b border-line-soft py-2 pr-0 pl-0 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-3 md:gap-y-[3px]"
    >
      <div ref={setTitleEl} className="flex min-w-0 items-center gap-2 md:col-start-1 md:row-start-1">
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
                <span className="sm:hidden">{format(now, `EEE · MMM d · ${timeFmt()}`)}</span>
                <span className="hidden sm:inline">{format(now, `EEEE · MMM d · ${timeFmt()}`)}</span>
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
            </>
          )}
        </div>
      </div>

      {!home && hasTabs && (
        <SectionNav
          inHeader
          wrap={tabsBelow}
          ref={setTabsEl}
          className={tabsBelow ? "-mt-[7px] md:col-span-2 md:row-start-2 md:mt-1" : "md:col-start-1 md:row-start-2"}
        />
      )}

      <div className={`flex shrink-0 items-center gap-2 md:col-start-2 md:row-start-1 ${!home && hasTabs && !tabsBelow ? "md:row-span-2" : ""}`}>
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

/**
 * True when the section tabs need more room than the title column beside the header actions.
 * Both widths are independent of where the tabs are drawn, so the choice never flips back and forth.
 */
function useTabsOverflow(titleEl: HTMLElement | null, tabsEl: HTMLElement | null, key: string) {
  const [overflow, setOverflow] = useState(false)
  useLayoutEffect(() => {
    if (!titleEl || !tabsEl) return
    const check = () => {
      const links = Array.from(tabsEl.children) as HTMLElement[]
      const gap = parseFloat(getComputedStyle(tabsEl).columnGap) || 0
      const need = links.reduce((sum, link) => sum + link.getBoundingClientRect().width, 0) + gap * Math.max(0, links.length - 1)
      setOverflow(need > titleEl.getBoundingClientRect().width + 0.5)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(titleEl)
    observer.observe(tabsEl)
    return () => observer.disconnect()
  }, [titleEl, tabsEl, key])
  return overflow
}
