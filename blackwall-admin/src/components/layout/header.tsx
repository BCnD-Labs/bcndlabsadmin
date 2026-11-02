import { format } from "date-fns"
import { Menu, Search } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { usePageHead } from "@/stores/page-head"
import { NAV, activeChild, isActive } from "./nav-config"
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
  const child = activeChild(dest, pathname, search)
  if (!child || dest.children?.length === 1) return [{ label: dest.label, to: pathname === dest.to ? undefined : dest.to }]
  // Deeper than the sub-page (a course, a post): the sub-page links back.
  return [{ label: dest.label, to: dest.to }, { label: child.label, to: pathname + search === child.to ? undefined : child.to }]
}

/** PageHeader supplies the title; the breadcrumb keeps navigation context. */
function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-[0.55em] font-mono text-[11px] leading-4 text-muted-foreground">
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

/** Application header: a quiet bar with the date line and greeting (or breadcrumb), search, + New, calendar and bell. */
export function Header() {
  const setMobileNavOpen = useUi((s) => s.setMobileNavOpen)
  const mobileNavOpen = useUi((s) => s.mobileNavOpen)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const workspaceName = usePrefs((s) => s.workspaceName).trim()
  const { pathname, search } = useLocation()
  const now = useNow()
  const home = pathname === "/"
  const head = usePageHead()
  const items = crumbs(pathname, search)

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
              <Breadcrumb items={items} />
              <div className="flex min-w-0 items-center gap-2.5">
                <h1 className="min-w-0 truncate font-heading text-xl leading-[26px] font-bold sm:text-2xl lg:text-[22px]">{head.title ?? items.at(-1)?.label}</h1>
                <span className="flex shrink-0 items-center gap-2">{head.badge}</span>
                {head.subtitle && <span className="hidden min-w-0 truncate text-xs text-muted-foreground 2xl:inline">{head.subtitle}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!home && head.actions && <div className="mr-1 hidden items-center gap-2 border-r border-line-soft pr-3 md:flex">{head.actions}</div>}
        <CalendarMenu />
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
          aria-keyshortcuts="Meta+K"
          className={`bw-well flex h-8 min-w-0 flex-1 items-center gap-2 px-2.5 text-left text-[13px] text-faint transition-colors hover:border-ledge-hi md:size-8 md:flex-none md:justify-center md:px-0 ${!home && head.actions ? "xl:w-[160px] xl:justify-start xl:px-2.5 2xl:w-[220px]" : "lg:w-[160px] lg:justify-start lg:px-2.5 xl:w-[220px]"}`}
        >
          <Search className="size-[13px] shrink-0" strokeWidth={2} aria-hidden />
          <span className={`flex-1 md:hidden ${!home && head.actions ? "xl:inline" : "lg:inline"}`}>search</span>
          <kbd className={`hidden rounded-[4px] border border-b-2 border-rim bg-raised px-[5px] py-px font-mono text-[10px] text-muted-foreground sm:inline md:hidden ${!home && head.actions ? "xl:inline" : "lg:inline"}`}>⌘K</kbd>
        </button>
        <QuickCreate quiet={!home && !!head.actions} />
        <Notifications />
      </div>
    </header>
  )
}
