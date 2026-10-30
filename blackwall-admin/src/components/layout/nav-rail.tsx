import { Pin, PinOff } from "lucide-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { NAV, isActive, type NavDestination } from "./nav-config"

/** Hover-intent timings (ms). */
const OPEN_DELAY = 120 // edge hover → rail appears
const SWITCH_DELAY = 110 // moving between icons while a flyout is open
const CLOSE_DELAY = 380 // pointer leaves rail + flyout

/**
 * Desktop navigation: a floating icon rail that is hidden until the left edge
 * is hovered (or the header menu button is used), with a flyout that shows
 * only the hovered/focused destination's label and submenu. It overlays the
 * page; only the optional pinned mode reserves space.
 */
export function NavRail({ focusMain }: { focusMain: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pinned = usePrefs((s) => s.railPinned)
  const edgeReveal = usePrefs((s) => s.edgeReveal)
  const setPrefs = usePrefs((s) => s.set)
  const railOpen = useUi((s) => s.railOpen)
  const setRailOpen = useUi((s) => s.setRailOpen)
  const railFocusRequest = useUi((s) => s.railFocusRequest)
  const menuButton = useUi((s) => s.menuButton)

  const visible = pinned || railOpen
  const [activeId, setActiveId] = useState<string | null>(null)
  const [flyoutTop, setFlyoutTop] = useState(0)

  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>())
  const flyoutRef = useRef<HTMLDivElement>(null)
  const timers = useRef<{ open?: number; close?: number; switch?: number }>({})
  const pointerType = useRef<string>("mouse")

  const clear = (k: "open" | "close" | "switch") => {
    window.clearTimeout(timers.current[k])
    timers.current[k] = undefined
  }

  const close = useCallback(
    (opts?: { restoreFocus?: boolean }) => {
      clear("open")
      clear("close")
      clear("switch")
      setActiveId(null)
      if (!usePrefs.getState().railPinned) setRailOpen(false)
      if (opts?.restoreFocus) menuButton?.focus()
    },
    [menuButton, setRailOpen],
  )

  const scheduleClose = () => {
    clear("close")
    timers.current.close = window.setTimeout(() => close(), CLOSE_DELAY)
  }

  // Position the flyout next to the active icon.
  useLayoutEffect(() => {
    if (!activeId) return
    const el = itemRefs.current.get(activeId)
    if (el) setFlyoutTop(el.offsetTop)
  }, [activeId])

  // The header menu button asks for focus to move into the rail.
  useEffect(() => {
    if (!railFocusRequest) return
    const current = NAV.find((d) => isActive(d, pathname)) ?? NAV[0]
    requestAnimationFrame(() => itemRefs.current.get(current.id)?.focus())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railFocusRequest])

  // Escape and outside taps close an open rail/flyout from anywhere.
  useEffect(() => {
    if (!railOpen && !activeId) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      const inside = navRef.current?.contains(document.activeElement)
      // When pinned the rail stays, so focus can stay on the rail item.
      close({ restoreFocus: inside && !usePrefs.getState().railPinned })
    }
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target as Node
      if (navRef.current?.contains(t) || menuButton?.contains(t)) return
      close()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
    }
  }, [railOpen, activeId, close, menuButton])

  useEffect(() => () => Object.values(timers.current).forEach(window.clearTimeout), [])

  // --- pointer -----------------------------------------------------------
  const onEdgeEnter = () => {
    if (!edgeReveal || visible) return
    clear("close")
    timers.current.open = window.setTimeout(() => setRailOpen(true), OPEN_DELAY)
  }
  const onEdgeLeave = () => {
    clear("open")
    if (railOpen && !pinned) scheduleClose()
  }

  const onItemPointerEnter = (id: string) => {
    clear("close")
    if (activeId === null || activeId === id) {
      clear("switch")
      setActiveId(id)
      return
    }
    clear("switch")
    timers.current.switch = window.setTimeout(() => setActiveId(id), SWITCH_DELAY)
  }

  const onItemClick = (e: MouseEvent, d: NavDestination) => {
    // On touch, the first tap reveals the submenu instead of navigating.
    if (pointerType.current === "touch" && d.children && activeId !== d.id) {
      e.preventDefault()
      setActiveId(d.id)
      return
    }
    afterSelect()
  }

  const afterSelect = () => {
    close()
    // Let the route render, then move focus to the page for keyboard users.
    requestAnimationFrame(focusMain)
  }

  // --- keyboard ----------------------------------------------------------
  const railItems = () => NAV.map((d) => itemRefs.current.get(d.id)!).filter(Boolean)
  const flyoutLinks = () =>
    Array.from(flyoutRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])

  const onRailKeyDown = (e: KeyboardEvent, d: NavDestination) => {
    const items = railItems()
    const i = items.indexOf(e.currentTarget as HTMLAnchorElement)
    const focusAt = (n: number) => items[(n + items.length) % items.length]?.focus()
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        focusAt(i + 1)
        break
      case "ArrowUp":
        e.preventDefault()
        focusAt(i - 1)
        break
      case "Home":
        e.preventDefault()
        focusAt(0)
        break
      case "End":
        e.preventDefault()
        focusAt(items.length - 1)
        break
      case "ArrowRight":
        if (d.children) {
          e.preventDefault()
          setActiveId(d.id)
          requestAnimationFrame(() => {
            // Index 0 is the destination label; land on the first submenu entry.
            const links = flyoutLinks()
            ;(links[1] ?? links[0])?.focus()
          })
        }
        break
    }
  }

  const onFlyoutKeyDown = (e: KeyboardEvent) => {
    const links = flyoutLinks()
    const i = links.indexOf(document.activeElement as HTMLAnchorElement)
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        links[(i + 1) % links.length]?.focus()
        break
      case "ArrowUp":
        e.preventDefault()
        links[(i - 1 + links.length) % links.length]?.focus()
        break
      case "ArrowLeft":
        e.preventDefault()
        if (activeId) itemRefs.current.get(activeId)?.focus()
        break
    }
  }

  const onNavBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && navRef.current?.contains(next)) return
    if (next && menuButton?.contains(next)) return
    // Focus left the navigation entirely.
    if (next) close()
  }

  const active = NAV.find((d) => d.id === activeId)

  return (
    <>
      {/* Left-edge activation region */}
      {edgeReveal && !pinned && (
        <div
          aria-hidden
          data-testid="nav-edge"
          className="fixed inset-y-0 left-0 z-40 hidden w-2.5 md:block"
          onPointerEnter={onEdgeEnter}
          onPointerLeave={onEdgeLeave}
        />
      )}

      <nav
        ref={navRef}
        aria-label="Main navigation"
        data-state={visible ? "open" : "closed"}
        data-testid="nav-rail"
        inert={!visible}
        className="fixed top-[3.75rem] left-2 z-50 hidden md:block"
        onPointerEnter={() => clear("close")}
        onPointerLeave={() => {
          clear("switch")
          scheduleClose()
        }}
        onPointerDown={(e: PointerEvent) => (pointerType.current = e.pointerType)}
        onBlur={onNavBlur}
      >
        <div
          className={cn(
            "retro-dots raised-edge flex flex-col gap-1 rounded-xl border bg-recessed p-1.5 shadow-lg shadow-black/25",
            "transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none",
            visible ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[calc(100%+1rem)] opacity-0",
          )}
        >
          <ul className="flex flex-col gap-1">
            {NAV.map((d) => {
              const Icon = d.icon
              const current = isActive(d, pathname)
              const highlighted = activeId === d.id
              return (
                <li key={d.id}>
                  <Link
                    ref={(el) => {
                      if (el) itemRefs.current.set(d.id, el)
                      else itemRefs.current.delete(d.id)
                    }}
                    to={d.to}
                    aria-label={d.label}
                    aria-current={current ? "page" : undefined}
                    aria-haspopup={d.children ? "menu" : undefined}
                    aria-expanded={d.children ? highlighted : undefined}
                    data-nav-id={d.id}
                    onPointerEnter={() => onItemPointerEnter(d.id)}
                    onFocus={() => {
                      clear("close")
                      setActiveId(d.id)
                    }}
                    onClick={(e) => onItemClick(e, d)}
                    onKeyDown={(e) => onRailKeyDown(e, d)}
                    className={cn(
                      "relative flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none",
                      "hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      highlighted && "bg-card text-foreground",
                      current &&
                        "bg-card text-amber before:absolute before:top-2 before:bottom-2 before:-left-1.5 before:w-0.5 before:rounded-full before:bg-amber",
                    )}
                  >
                    <Icon className="size-[1.15rem]" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="mx-1 my-0.5 h-px bg-border" />
          <button
            type="button"
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin navigation rail" : "Pin navigation rail"}
            title={pinned ? "Unpin rail" : "Pin rail"}
            onClick={() => setPrefs({ railPinned: !pinned })}
            onPointerEnter={() => {
              clear("switch")
              setActiveId(null)
            }}
            onFocus={() => setActiveId(null)}
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-teal"
          >
            {pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
          </button>
        </div>

        {/* Flyout: label + submenu for the one active destination only.
            The left padding bridges the gap so moving across it keeps it open. */}
        {visible && active && (
          <div
            ref={flyoutRef}
            data-testid="nav-flyout"
            className="absolute left-full pl-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1"
            style={{ top: flyoutTop + 6 /* rail padding */ - 4 }}
            onPointerEnter={() => clear("switch")}
            onKeyDown={onFlyoutKeyDown}
          >
            <div className="min-w-48 rounded-lg border bg-popover p-1 shadow-lg shadow-black/25">
              <Link
                to={active.to}
                onClick={afterSelect}
                className="flex h-8 items-center rounded-md px-2 text-sm font-bold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                {active.label}
              </Link>
              {active.children && (
                <ul role="menu" aria-label={`${active.label} sections`} className="mt-0.5 border-t pt-1">
                  {active.children.map((c) => {
                    const here = pathname === c.to || pathname.startsWith(c.to + "/")
                    return (
                      <li key={c.to} role="none">
                        <Link
                          role="menuitem"
                          to={c.to}
                          aria-current={here ? "page" : undefined}
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(c.to)
                            afterSelect()
                          }}
                          className={cn(
                            "flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground outline-none",
                            "hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                            here && "text-amber",
                          )}
                        >
                          {c.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
