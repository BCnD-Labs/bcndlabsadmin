import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

/**
 * Spec §7 underline tabs, for switching between views of one page (they're links,
 * so each view has its own URL). Filters inside a panel use SegmentedTabs instead.
 */
export function ViewTabs({
  items,
  label,
  className,
}: {
  items: { label: string; to: string; active: boolean }[]
  label: string
  className?: string
}) {
  return (
    <nav aria-label={label} className={cn("mb-4 flex gap-1 border-b border-line", className)}>
      {items.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          replace
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px flex h-9 items-center border-b-2 border-transparent px-3 font-mono text-xs whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-ink",
            t.active && "border-red text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
