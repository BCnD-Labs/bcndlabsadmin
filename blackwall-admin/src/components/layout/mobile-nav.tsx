import { NavLink, useLocation } from "react-router-dom"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { NAV, isActive } from "./nav-config"

/** Small screens: conventional menu button + sheet with the full tree. */
export function MobileNav() {
  const open = useUi((s) => s.mobileNavOpen)
  const setOpen = useUi((s) => s.setMobileNavOpen)
  const { pathname } = useLocation()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent id="mobile-nav" side="left" className="w-72 gap-0 bg-recessed p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="font-pixel text-2xl font-normal tracking-wide">Blackwall</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((d) => {
              const Icon = d.icon
              const current = isActive(d, pathname)
              return (
                <li key={d.id}>
                  <NavLink
                    to={d.to}
                    end={d.to === "/"}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-bold outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
                      current && "bg-card text-amber",
                    )}
                    aria-current={current && !d.children ? "page" : undefined}
                  >
                    <Icon className="size-4" aria-hidden />
                    {d.label}
                  </NavLink>
                  {d.children && d.children.length > 1 && (
                    <ul className="mb-1 ml-7 border-l pl-2">
                      {d.children.map((c) => (
                        <li key={c.to}>
                          <NavLink
                            to={c.to}
                            onClick={() => setOpen(false)}
                            className={({ isActive: here }) =>
                              cn(
                                "flex h-10 items-center rounded-md px-3 text-sm text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                                here && "text-amber",
                              )
                            }
                          >
                            {c.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
