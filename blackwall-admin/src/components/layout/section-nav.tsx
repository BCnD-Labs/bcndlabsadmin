import { Link, useLocation } from "react-router-dom"
import { NAV, activeChild, isActive } from "./nav-config"
import { cn } from "@/lib/utils"

/** Sibling destinations stay visible without opening a rail flyout. */
export function SectionNav() {
  const { pathname, search } = useLocation()
  const destination = NAV.find((d) => isActive(d, pathname))
  if (!destination?.children?.length) return null
  const current = activeChild(destination, pathname, search)
  return (
    <nav aria-label={`${destination.label} sections`} className="mb-4 flex flex-wrap gap-x-5 gap-y-1 border-b border-line-soft">
      {destination.children.map((child) => (
        <Link key={child.to} to={child.to} aria-current={current === child ? "page" : undefined}
          className={cn("flex min-h-9 items-center border-b-2 border-transparent px-0.5 text-xs text-muted-foreground hover:text-ink", current === child && "border-red font-semibold text-ink")}>
          {child.label}
        </Link>
      ))}
    </nav>
  )
}
