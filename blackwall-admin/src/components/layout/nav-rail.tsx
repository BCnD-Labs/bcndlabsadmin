import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { NAV, isActive, type NavDestination } from "./nav-config"
import { initials, useNavHints } from "./nav-hints"

/** Hover-intent timings (ms). */
const OPEN_DELAY = 60 // first hover; avoids flicker when the cursor just passes over
const CLOSE_DELAY = 220 // leaving the expanded item

/**
 * Desktop navigation (spec §4): a full-height 60px panel of 40×40 icons. Hovering
 * or focusing one icon grows that button into a 220px pill (label + hint), and
 * its sub-pages unfold beneath the label starting at x=44px. The pill is an
 * inverted L, so the icon column stays uncovered and the pointer can move
 * straight down from icon to icon. Opening animates; closing is instant.
 */
export function NavRail({ focusMain }: { focusMain: () => void }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const workspaceName = usePrefs((s) => s.workspaceName)
  const hints = useNavHints()
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
    const h = hints[d.id]
    const hasSubs = !!d.children?.length
    return (
      <li
        key={d.id}
        className={cn("relative size-10 shrink-0", open && "z-10")}
        onPointerEnter={() => hoverOpen(d.id)}
        onPointerLeave={hoverClose}
        onBlur={onBlurWithin(d.id)}
      >
        {/* The button itself: a 40×40 icon that grows into the pill's head row. */}
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
          data-open={open}
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
            "absolute top-0 left-0 flex h-[43px] w-10 items-start overflow-hidden rounded-[10px] border-r-[3px] border-b-[3px] border-transparent whitespace-nowrap",
            "transition-none data-[open=true]:transition-[width,background-color,border-color,box-shadow] data-[open=true]:duration-200 data-[open=true]:ease-bw motion-reduce:transition-none",
            current ? "bg-red text-white" : "text-faint hover:bg-raised",
            open && "w-[220px] border-ledge-hi shadow-[0_14px_30px_rgba(0,0,0,0.45)]",
            open && !current && "bg-line text-ink-2",
            open && hasSubs && "rounded-br-none",
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center">
            <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </span>
          <span
            className={cn(
              "flex h-10 min-w-0 flex-1 items-center justify-between gap-2 pr-3 transition-[opacity,transform] motion-reduce:transition-none",
              open ? "translate-x-0 opacity-100 delay-[40ms] duration-200 ease-bw" : "-translate-x-1.5 opacity-0 duration-0",
            )}
          >
            <span className="font-heading text-[13px] font-bold text-white">{d.label}</span>
            {h?.hint && <span className={cn("text-[10px]", current ? "text-[#F3C9C9]" : "text-faint")}>{h.hint}</span>}
          </span>
        </Link>

        {/* Sub-pages unfold below the label, from x=44 to the pill's right edge. */}
        {hasSubs && (
          <div
            ref={(el) => {
              if (el) panelRefs.current.set(d.id, el)
              else panelRefs.current.delete(d.id)
            }}
            data-testid={open ? "nav-expanded" : undefined}
            data-open={open}
            className={cn(
              "absolute top-10 left-11 grid w-[176px] rounded-b-[10px] border-r-[3px] border-b-[3px] border-ledge-hi bg-raised shadow-[0_14px_30px_rgba(0,0,0,0.45)]",
              "transition-none data-[open=true]:transition-[grid-template-rows] data-[open=true]:duration-[220ms] data-[open=true]:ease-bw motion-reduce:transition-none",
              open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
            )}
          >
            <ul role="menu" aria-label={`${d.label} pages`} className="min-h-0 overflow-hidden py-1.5">
              {d.children!.map((c) => {
                const here = pathname + search === c.to || pathname.startsWith(c.to + "/")
                const count = h?.subs?.[c.to]
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
                        "mx-1.5 flex h-[30px] items-center justify-between gap-2 rounded-[6px] px-2 font-mono text-xs whitespace-nowrap text-[#A3A8B1] outline-none",
                        "hover:bg-line hover:text-white focus-visible:bg-line focus-visible:text-white focus-visible:outline-2 focus-visible:outline-ring",
                        here && "text-white before:mr-1 before:size-1.5 before:shrink-0 before:rounded-[1.5px] before:bg-red before:content-['']",
                      )}
                    >
                      <span className="mr-auto truncate">{c.label}</span>
                      {count && <span className="text-[10px] text-faint">{count}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </li>
    )
  }

  return (
    <nav
      aria-label="Main navigation"
      data-testid="nav-rail"
      className="bw-panel fixed top-3 bottom-3 left-3 z-40 hidden w-[60px] flex-col items-center gap-2 py-3.5 after:hidden md:flex"
    >
      <div
        aria-hidden
        className="mb-2 flex size-[34px] shrink-0 items-center justify-center rounded-[8px] border-r-[3px] border-b-[3px] border-red-ledge bg-red font-pixel text-xs text-white"
      >
        BW
      </div>
      <ul className="flex flex-col items-center gap-2">{NAV.map(renderItem)}</ul>
      <div className="flex-1" />
      <div
        role="img"
        aria-label={workspaceName ? `Workspace: ${workspaceName}` : "Blackwall"}
        title={workspaceName || undefined}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-line font-pixel text-[10px] text-ink"
      >
        {initials(workspaceName)}
      </div>
    </nav>
  )
}
