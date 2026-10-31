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
  const { pathname, search } = useLocation()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent id="mobile-nav" side="left" className="w-72 gap-0 border-r-4 border-ledge bg-panel p-0">
        <SheetHeader className="border-b border-line px-4 py-3">
          <SheetTitle className="flex items-center gap-2.5 font-heading text-base font-bold">
            <span aria-hidden className="flex size-[30px] items-center justify-center rounded-[7px] border-r-[3px] border-b-[3px] border-red-ledge bg-red font-pixel text-[11px] font-normal text-white">BW</span>
            Blackwall
          </SheetTitle>
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
                      "flex h-11 items-center gap-3 rounded-[8px] px-3 font-heading text-[13px] font-bold text-ink-2 hover:bg-raised",
                      current && "bg-red text-white hover:bg-red",
                    )}
                    aria-current={current && !d.children ? "page" : undefined}
                  >
                    <Icon className="size-4" aria-hidden />
                    {d.label}
                  </NavLink>
                  {d.children && d.children.length > 1 && (
                    <ul className="mb-1 ml-7 border-l border-line pl-2">
                      {d.children.map((c) => (
                        <li key={c.to}>
                          <NavLink
                            to={c.to}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex h-10 items-center gap-2 rounded-[6px] px-3 font-mono text-xs text-[#A3A8B1] hover:bg-raised hover:text-white",
                              (pathname + search === c.to || pathname.startsWith(c.to + "/")) &&
                                "text-white before:size-1.5 before:rounded-[1.5px] before:bg-red before:content-['']",
                            )}
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
