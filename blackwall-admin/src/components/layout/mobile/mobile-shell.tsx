import { Component, type ComponentType, type ReactNode } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { Menu } from "lucide-react"
import { CATEGORIES } from "@/components/common/category-icon"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { isActive, useNav } from "../nav-config"

/**
 * Mobile view pages, added one at a time. A route listed here renders its mobile page; every
 * other route falls back to the responsive page inside the mobile frame, so nothing becomes
 * unreachable while the mobile view is being built. Keys are exact pathnames.
 */
const MOBILE_PAGES: Record<string, ComponentType> = {}

export function MobileOutlet() {
  const { pathname } = useLocation()
  const Page = MOBILE_PAGES[pathname]
  return Page ? <Page /> : <Outlet />
}

/** Bottom tab bar: your sidebar sections (names and hidden ones follow Settings), plus More. */
export function MobileTabBar() {
  const nav = useNav().slice(0, 4)
  const { pathname } = useLocation()
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ground/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="mx-auto flex max-w-xl">
        {nav.map((d) => {
          const Icon = CATEGORIES[d.category]
          const on = isActive(d, pathname)
          return (
            <li key={d.id} className="flex-1">
              <Link to={d.to} aria-current={on ? "page" : undefined} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px]", on ? "text-ink" : "text-muted-foreground")}>
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", on && "bg-selected")}><Icon className="size-5" aria-hidden /></span>
                <span className="max-w-full truncate px-1">{d.label}</span>
              </Link>
            </li>
          )
        })}
        <li className="flex-1">
          <button type="button" onClick={() => useUi.getState().setMobileNavOpen(true)} className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10.5px] text-muted-foreground">
            <span className="flex h-7 w-12 items-center justify-center rounded-full"><Menu className="size-5" aria-hidden /></span>
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}

/**
 * Catches any crash inside the mobile view and offers the way back to the responsive layout,
 * so a broken mobile page can never lock you out.
 */
export class MobileBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-6 max-w-sm space-y-3 rounded-2xl bg-panel p-5 text-sm">
        <p className="font-semibold text-ink">The mobile view hit a problem.</p>
        <p className="text-muted-foreground">Switch back to the responsive layout to keep working. You can turn the mobile view on again in Settings → Appearance.</p>
        <p className="font-mono text-xs break-words text-faint">{this.state.error.message}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => usePrefs.getState().set({ layoutMode: "responsive" })}>Switch to responsive layout</Button>
          <Button variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      </div>
    )
  }
}
