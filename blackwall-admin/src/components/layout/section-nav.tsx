import type { Ref } from "react"
import { Link, useLocation } from "react-router-dom"
import { useNav, activeChild, activeIn } from "./nav-config"
import { cn } from "@/lib/utils"

/**
 * Sibling destinations stay visible without opening a rail flyout. In the app header the tabs
 * sit on one line under the title, or, with `wrap`, on their own row where they wrap rather
 * than scroll, so no label is ever cut off.
 */
export function SectionNav({ inHeader = false, wrap = false, className, ref }: { inHeader?: boolean; wrap?: boolean; className?: string; ref?: Ref<HTMLElement> }) {
  const NAV = useNav(true)
  const { pathname, search } = useLocation()
  const destination = activeIn(NAV, pathname)
  if (!destination?.children?.length) return null
  const current = activeChild(destination, pathname, search)
  return (
    <nav
      ref={ref}
      aria-label={`${destination.label} sections`}
      className={cn("flex min-w-0 gap-x-5 gap-y-1", inHeader ? (wrap ? "-mb-2 flex-wrap gap-y-0" : "-mb-2 overflow-x-auto [scrollbar-width:none]") : "mb-3 flex-wrap border-b border-line-soft", className)}
    >
      {destination.children.map((child) => (
        <Link key={child.to} to={child.to} aria-current={current === child ? "page" : undefined}
          className={cn("flex shrink-0 items-center border-b-2 border-transparent px-0.5 text-xs whitespace-nowrap text-muted-foreground hover:text-ink", inHeader ? "h-8" : "min-h-[var(--bw-control-h)]", current === child && "border-red font-semibold text-ink")}>
          {child.label}
        </Link>
      ))}
    </nav>
  )
}
