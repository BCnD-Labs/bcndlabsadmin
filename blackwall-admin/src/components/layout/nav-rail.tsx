import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { NAV, isActive, type NavDestination } from "./nav-config"

/** Hover-intent timings (ms). */
const OPEN_DELAY = 60 // first hover; avoids flicker when the cursor just passes over
const CLOSE_DELAY = 220 // leaving the expanded item

/**
 * Desktop navigation: a thin, always-visible icon strip (like a collapsed
 * browser sidebar). Hovering or focusing one icon expands only that item into
 * its label plus its sub-pages; the other icons stay compact and reachable.
 */
export function NavRail({ focusMain }: { focusMain: () => void }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [openId, setOpenId] = useState<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>())
  const panelRefs = useRef(new Map<string, HTMLDivElement>())
  const timer = useRef<number | undefined>(undefined)
  const pointerType = useRef("mouse")

  const clearTimer = () => window.clearTimeout(timer.current)
  const collapse = useCallback(() => {
    clearTimer()
    setOpenId(null)
  }, [])

  const hoverOpen = (id: string) => {
    clearTimer()
    if (openId) setOpenId(id) // already expanded: switch straight away
    else timer.current = window.setTimeout(() => setOpenId(id), OPEN_DELAY)
  }
  const hoverClose = () => {
    clearTimer()
    timer.current = window.setTimeout(() => setOpenId(null), CLOSE_DELAY)
  }

  useEffect(() => () => clearTimer(), [])

  // Escape collapses from anywhere; a tap outside collapses on touch screens.
  useEffect(() => {
    if (!openId) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && collapse()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (![...itemRefs.current.values(), ...panelRefs.current.values()].some((el) => el.contains(t))) collapse()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
    }
  }, [openId, collapse])

  const select = (to: string) => (e: MouseEvent) => {
    e.preventDefault()
    navigate(to)
    collapse()
    requestAnimationFrame(focusMain)
  }

  // --- keyboard ----------------------------------------------------------
  const items = () => NAV.map((d) => itemRefs.current.get(d.id)!).filter(Boolean)
  const subLinks = (id: string) =>
    Array.from(panelRefs.current.get(id)?.querySelectorAll<HTMLAnchorElement>("[data-sub]") ?? [])

  const onItemKey = (e: KeyboardEvent, d: NavDestination) => {
    const list = items()
    const i = list.indexOf(e.currentTarget as HTMLAnchorElement)
    const go = (n: number) => list[(n + list.length) % list.length]?.focus()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      go(i + 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      go(i - 1)
    } else if (e.key === "Home") {
      e.preventDefault()
      go(0)
    } else if (e.key === "End") {
      e.preventDefault()
      go(list.length - 1)
    } else if (e.key === "ArrowRight" && d.children) {
      e.preventDefault()
      setOpenId(d.id)
      requestAnimationFrame(() => subLinks(d.id)[0]?.focus())
    }
  }

  const onSubKey = (e: KeyboardEvent, id: string) => {
    const links = subLinks(id)
    const i = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      links[(i + 1) % links.length]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      links[(i - 1 + links.length) % links.length]?.focus()
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      itemRefs.current.get(id)?.focus()
    }
  }

  // Collapse when focus leaves an item and its expansion entirely.
  const onBlurWithin = (id: string) => (e: React.FocusEvent<HTMLLIElement>) => {
    const next = e.relatedTarget as Node | null
    if (!next || !e.currentTarget.contains(next)) setOpenId((o) => (o === id ? null : o))
  }

  const renderItem = (d: NavDestination) => {
    const Icon = d.icon
    const current = isActive(d, pathname)
    const open = openId === d.id
    return (
      <li
        key={d.id}
        className="relative"
        onPointerEnter={() => hoverOpen(d.id)}
        onPointerLeave={hoverClose}
        onBlur={onBlurWithin(d.id)}
      >
        {/* The strip icon: always present, focusable, navigates to the section. */}
        <Link
          ref={(el) => {
            if (el) itemRefs.current.set(d.id, el)
            else itemRefs.current.delete(d.id)
          }}
          to={d.to}
          aria-label={d.label}
          aria-current={current ? "page" : undefined}
          aria-haspopup={d.children ? "menu" : undefined}
          aria-expanded={d.children ? open : undefined}
          data-nav-id={d.id}
          onPointerDown={(e) => (pointerType.current = e.pointerType)}
          onFocus={() => setOpenId(d.id)}
          onClick={(e) => {
            // Touch: the first tap expands, a second tap navigates.
            if (pointerType.current === "touch" && d.children && !open) {
              e.preventDefault()
              setOpenId(d.id)
              return
            }
            select(d.to)(e)
          }}
          onKeyDown={(e) => onItemKey(e, d)}
          className={cn(
            "relative z-10 flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors",
            "hover:text-teal focus-visible:ring-2 focus-visible:ring-ring",
            current && "border-2 border-black bg-amber text-black shadow-brutal-sm hover:text-black",
          )}
        >
          <Icon className="size-[1.15rem]" aria-hidden />
        </Link>

        {/* Expansion grows out of the icon: the label pill covers only the icon's row,
            and the sub-pages hang to the right of the strip so the other icons stay reachable. */}
        <div
          ref={(el) => {
            if (el) panelRefs.current.set(d.id, el)
            else panelRefs.current.delete(d.id)
          }}
          data-testid={open ? "nav-expanded" : undefined}
          data-open={open}
          className="pointer-events-none absolute top-0 left-0 z-20 data-[open=true]:pointer-events-auto"
        >
          <Link
            to={d.to}
            tabIndex={-1}
            aria-hidden
            onClick={select(d.to)}
            className={cn(
              "flex h-10 items-center gap-3 overflow-hidden rounded-lg border-2 pr-4 pl-[9px] whitespace-nowrap",
              "transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none",
              current ? "border-black bg-amber text-black shadow-brutal-sm" : "glow-teal border-teal bg-card text-teal",
              open ? "max-w-72 opacity-100" : "max-w-10 opacity-0",
            )}
          >
            <Icon className="size-[1.15rem] shrink-0" aria-hidden />
            <span className="font-heading text-sm font-bold tracking-wide uppercase">{d.label}</span>
          </Link>
          {d.children && (
            <div
              className={cn(
                "ml-12 pt-1.5 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                open ? "translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
              )}
            >
              <ul role="menu" aria-label={`${d.label} pages`} className="brutal min-w-52 rounded-xl bg-popover p-1.5">
                {d.children.map((c) => {
                  const here = pathname + search === c.to || pathname.startsWith(c.to + "/")
                  return (
                    <li key={c.to} role="none">
                      <Link
                        role="menuitem"
                        data-sub
                        to={c.to}
                        tabIndex={open ? 0 : -1}
                        aria-current={here ? "page" : undefined}
                        onClick={select(c.to)}
                        onKeyDown={(e) => onSubKey(e, d.id)}
                        className={cn(
                          "flex h-8 items-center rounded-md px-2.5 text-sm whitespace-nowrap text-muted-foreground outline-none",
                          "hover:bg-muted hover:text-teal focus-visible:bg-muted focus-visible:text-teal focus-visible:ring-2 focus-visible:ring-ring",
                          here && "text-amber before:mr-1.5 before:content-['▸']",
                        )}
                      >
                        {c.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <nav
      aria-label="Main navigation"
      data-testid="nav-rail"
      className="retro-dots fixed top-14 bottom-0 left-0 z-40 hidden w-14 flex-col items-center border-r-2 border-edge bg-recessed py-3 md:flex"
    >
      <ul className="flex flex-col items-center gap-1.5">{NAV.filter((d) => d.id !== "settings").map(renderItem)}</ul>
      <ul className="mt-auto flex flex-col items-center gap-1.5">{NAV.filter((d) => d.id === "settings").map(renderItem)}</ul>
    </nav>
  )
}
