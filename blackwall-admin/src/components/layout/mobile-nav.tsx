import { CategoryIcon } from "@/components/common/category-icon"
import { Settings } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useNav, activeIn, activeChild } from "./nav-config"

/** Small screens: conventional menu button + sheet with the full tree. */
export function MobileNav() {
  const NAV = useNav()
  const open = useUi((s) => s.mobileNavOpen)
  const setOpen = useUi((s) => s.setMobileNavOpen)
  const openSettings = useUi((s) => s.openSettings)
  const { pathname, search } = useLocation()
  const activeId = activeIn(NAV, pathname)?.id

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent id="mobile-nav" side="left" className="w-72 gap-0 border-r border-border bg-panel p-0">
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
              const current = d.id === activeId
              return (
                <li key={d.id}>
                  <Link
                    to={d.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-[8px] px-3 text-sm font-medium text-ink-2 hover:bg-raised",
                      current && "bg-red-soft text-ink hover:bg-red-soft",
                    )}
                    aria-current={current && !d.children ? "page" : undefined}
                  >
                    <CategoryIcon category={d.category} />
                    {d.label}
                  </Link>
                  {d.children && d.children.length > 1 && (
                    <ul className="mb-1 ml-7 border-l border-line pl-2">
                      {d.children.map((c) => {
                        const here = current && activeChild(d, pathname, search) === c
                        return (
                          <li key={c.to}>
                            <Link
                              to={c.to}
                              onClick={() => setOpen(false)}
                              aria-current={here ? "page" : undefined}
                              className={cn(
                                "flex h-10 items-center gap-2 rounded-[6px] px-3 text-[13px] text-muted-foreground hover:bg-raised hover:text-white",
                                here && "text-white before:size-1.5 before:rounded-[1.5px] before:bg-red before:content-['']",
                              )}
                            >
                              {c.label}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="border-t border-line p-2">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => openSettings()}
            className="flex h-11 w-full items-center gap-3 rounded-[8px] px-3 text-sm font-medium text-ink-2 hover:bg-raised"
          >
            <Settings className="size-4" aria-hidden />
            Settings
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
