import { Link, useLocation } from "react-router-dom"
import { useNav, activeChild, isActive } from "./nav-config"
import { cn } from "@/lib/utils"

/** Sibling destinations stay visible without opening a rail flyout. */
export function SectionNav({ inHeader = false }: { inHeader?: boolean }) {
  const NAV = useNav(true)
  const { pathname, search } = useLocation()
  const destination = NAV.find((d) => isActive(d, pathname))
  if (!destination?.children?.length) return null
  const current = activeChild(destination, pathname, search)
  return (
    <nav aria-label={`${destination.label} sections`} className={cn("flex gap-x-5 gap-y-1", inHeader ? "-mb-2 overflow-x-auto [scrollbar-width:none]" : "mb-3 flex-wrap border-b border-line-soft")}>
      {destination.children.map((child) => (
        <Link key={child.to} to={child.to} aria-current={current === child ? "page" : undefined}
          className={cn("flex shrink-0 items-center border-b-2 border-transparent px-0.5 text-xs whitespace-nowrap text-muted-foreground hover:text-ink", inHeader ? "h-8" : "min-h-[var(--bw-control-h)]", current === child && "border-red font-semibold text-ink")}>
          {child.label}
        </Link>
      ))}
    </nav>
  )
}
