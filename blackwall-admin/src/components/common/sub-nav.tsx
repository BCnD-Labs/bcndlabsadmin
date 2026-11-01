import type { LucideIcon } from "lucide-react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SubNavItem {
  label: string
  to: string
  icon: LucideIcon
}

/**
 * Spec §7 section sub-nav. Desktop (lg+): a panel of icon + label rows on the left;
 * the active row is filled. Phones and tablets: a select above the content.
 */
export function SubNav({ items, label, className }: { items: readonly SubNavItem[]; label: string; className?: string }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = items.find((i) => pathname === i.to || pathname.startsWith(i.to + "/")) ?? items[0]

  return (
    <>
      <nav aria-label={label} className={cn("bw-panel hidden self-start p-1.5 after:hidden lg:block", className)}>
        <ul className="flex flex-col gap-0.5">
          {items.map(({ label: text, to, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-2.5 rounded-[7px] border-r-2 border-b-2 border-transparent px-2.5 font-mono text-xs text-muted-foreground transition-colors duration-150 hover:bg-raised hover:text-ink",
                    isActive && "border-ledge-hi bg-selected text-ink hover:bg-selected",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("size-4 shrink-0", isActive ? "text-red" : "text-faint")} strokeWidth={1.8} aria-hidden />
                    <span className="truncate">{text}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="lg:hidden">
        <Select value={current.to} onValueChange={(to) => navigate(to)}>
          <SelectTrigger aria-label={label} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {items.map(({ label: text, to, icon: Icon }) => (
              <SelectItem key={to} value={to}>
                <Icon className="size-4 text-faint" strokeWidth={1.8} aria-hidden />
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
