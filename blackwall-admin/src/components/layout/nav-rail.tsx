import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronRight, PanelLeftClose, Settings } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { usePrefs } from "@/stores/prefs"
import { NAV, isActive, type NavDestination, activeChild } from "./nav-config"
import { useNavHints } from "./nav-hints"

/** Hover-intent timings (ms). */
const OPEN_DELAY = 60 // first hover; avoids flicker when the cursor just passes over
const CLOSE_DELAY = 220 // leaving the expanded item

/**
 * Desktop navigation (spec §4): a full-height 60px panel of 40×40 icons. Hovering
 * or focusing one icon grows that button into a 220px pill (label + hint), and
 * its sub-pages unfold beneath the label starting at x=44px. The pill is an
 * inverted L, so the icon column stays uncovered and the pointer can move
 * straight down from icon to icon. Opening animates; closing is instant.
 *
 * The red BW mark switches to the full sidebar (NavTree), where sections open on
 * click instead of hover. Settings sits at the bottom and opens the settings modal.
 */
export function NavRail({ focusMain }: { focusMain: () => void }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const expanded = usePrefs((s) => s.navExpanded)
  const setPrefs = usePrefs((s) => s.set)
  const toggleExpanded = () => {
    setOpenId(null)
    setPrefs({ navExpanded: !expanded })
  }
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
        className={cn("relative size-[var(--bw-nav-item)] shrink-0", open && "z-10")}
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
            "absolute top-0 left-0 flex h-[var(--bw-nav-item)] w-[var(--bw-nav-item)] items-start overflow-hidden rounded-[10px] border border-transparent whitespace-nowrap",
            "transition-none data-[open=true]:transition-[width,background-color,border-color,box-shadow] data-[open=true]:duration-200 data-[open=true]:ease-bw motion-reduce:transition-none",
            current ? "bg-red-soft text-red-light" : "text-faint hover:bg-raised hover:text-ink-2",
            open && "w-[var(--bw-tree-width)] border-ledge-hi shadow-[0_18px_40px_-10px_rgba(0,0,0,0.65)]",
            open && !current && "bg-line text-ink-2",
            open && hasSubs && "rounded-br-none",
          )}
        >
          <span className="flex size-[var(--bw-nav-item)] shrink-0 items-center justify-center">
            <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </span>
          <span
            className={cn(
              "flex h-[var(--bw-nav-item)] min-w-0 flex-1 items-center justify-between gap-2 pr-3 transition-[opacity,transform] motion-reduce:transition-none",
              open ? "translate-x-0 opacity-100 delay-[40ms] duration-200 ease-bw" : "-translate-x-1.5 opacity-0 duration-0",
            )}
          >
            <span className="text-[13px] font-semibold text-ink">{d.label}</span>
            {h?.hint && <span className={cn("text-[10px]", current ? "text-red-light" : "text-faint")}>{h.hint}</span>}
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
              "absolute top-10 left-11 grid w-[176px] rounded-b-[10px] border-r-[3px] border-b-[3px] border-ledge-hi bg-raised shadow-[0_18px_40px_-10px_rgba(0,0,0,0.65)]",
              "transition-none data-[open=true]:transition-[grid-template-rows] data-[open=true]:duration-[220ms] data-[open=true]:ease-bw motion-reduce:transition-none",
              open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
            )}
          >
            <ul role="menu" aria-label={`${d.label} pages`} className="min-h-0 overflow-hidden py-1.5">
              {d.children!.map((c) => {
                const here = activeChild(d, pathname, search) === c
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
                        "mx-1.5 flex h-[var(--bw-nav-row)] items-center justify-between gap-2 rounded-[6px] px-2 text-[13px] whitespace-nowrap text-muted-foreground outline-none",
                        "hover:bg-line hover:text-white focus-visible:bg-line focus-visible:text-white focus-visible:outline-2 focus-visible:outline-ring",
                        here && "text-white before:mr-1 before:size-1.5 before:shrink-0 before:rounded-[1.5px] before:bg-red before:content-['']",
                      )}
                    >
                      <span className="mr-auto truncate">{c.label}</span>
                      {count && <span className="text-[10px] text-muted-foreground">{count}</span>}
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
      id="nav-rail"
      aria-label="Main navigation"
      data-testid="nav-rail"
      data-expanded={expanded}
      className={cn(
        "bw-navigation fixed top-3 bottom-3 left-3 z-40 hidden flex-col py-3.5 after:hidden md:flex",
        "transition-[width] duration-200 ease-bw motion-reduce:transition-none",
        expanded ? "w-[var(--bw-tree-width)] px-2.5" : "w-[var(--bw-rail-width)] items-center gap-2",
      )}
    >
      <BrandButton expanded={expanded} onToggle={toggleExpanded} />
      {expanded ? <NavTree /> : <ul className="mt-2 flex flex-col items-center gap-2">{NAV.map(renderItem)}</ul>}
      <div className="flex-1" />
      <SettingsButton expanded={expanded} />
    </nav>
  )
}

const BW_MARK =
  "flex size-[34px] shrink-0 items-center justify-center rounded-[8px] border-r-[3px] border-b-[3px] border-red-ledge bg-red font-pixel text-xs text-white"

/** The red BW mark: switches between the icon strip and the full sidebar. */
function BrandButton({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const label = expanded ? "Collapse sidebar" : "Expand sidebar"
  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={label} aria-expanded={false} aria-controls="nav-rail" onClick={onToggle} className={cn(BW_MARK, "transition-transform duration-150 hover:scale-105 active:translate-y-px")}>
            BW
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded
      aria-controls="nav-rail"
      onClick={onToggle}
      className="group/brand flex items-center gap-2.5 rounded-[10px] py-0.5 pr-1.5 pl-[3px] text-left hover:bg-raised"
    >
      <span aria-hidden className={BW_MARK}>BW</span>
      <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold">Blackwall</span>
      <PanelLeftClose className="size-4 shrink-0 text-faint group-hover/brand:text-ink-2" strokeWidth={1.8} aria-hidden />
    </button>
  )
}

/** Bottom of the rail: opens the settings modal. */
function SettingsButton({ expanded }: { expanded: boolean }) {
  const open = useUi((s) => !!s.settings)
  const openSettings = useUi((s) => s.openSettings)
  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Settings"
            aria-keyshortcuts="Meta+Comma"
            aria-haspopup="dialog"
            onClick={() => openSettings()}
            className={cn(
              "flex size-[var(--bw-nav-item)] shrink-0 items-center justify-center rounded-[10px] border border-transparent",
              open ? "bg-red-soft text-red-light" : "text-faint hover:bg-raised hover:text-ink-2",
            )}
          >
            <Settings className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Settings <span className="ml-1 text-faint">⌘,</span></TooltipContent>
      </Tooltip>
    )
  }
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+Comma"
      onClick={() => openSettings()}
      className={cn(TREE_ROW, open ? TREE_FILL : "text-ink-2 hover:bg-raised")}
    >
      <Settings className={cn("size-[18px] shrink-0", open ? "text-red-light" : "text-faint")} strokeWidth={1.8} aria-hidden />
      <span className="flex-1 text-left">Settings</span>
      <kbd aria-hidden className={cn("font-mono text-[10px] font-normal", open ? "text-red-light" : "text-faint")}>⌘,</kbd>
    </button>
  )
}

const TREE_ROW =
  "flex h-[var(--bw-nav-item)] w-full shrink-0 items-center gap-3 rounded-[10px] border border-transparent px-2.5 text-[13px] font-medium transition-colors duration-150"
const TREE_FILL = "bg-red-soft font-semibold text-ink hover:bg-red-soft"

/**
 * The full sidebar: every destination as a row. Sections with pages open and close
 * on click like folders (→ / ← too); the one you're in starts open.
 */
function NavTree() {
  const { pathname, search } = useLocation()
  const hints = useNavHints()
  const activeId = NAV.find((d) => isActive(d, pathname))?.id
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeId ? [activeId] : []))
  const [seen, setSeen] = useState(activeId)
  if (activeId !== seen) {
    setSeen(activeId)
    if (activeId && !open.has(activeId)) setOpen(new Set(open).add(activeId))
  }
  const setFolder = (id: string, to: boolean) =>
    setOpen((o) => {
      const n = new Set(o)
      if (to) n.add(id)
      else n.delete(id)
      return n
    })

  return (
    <ul className="mt-4 -mr-1 flex min-h-0 flex-col gap-1 overflow-y-auto pr-1" aria-label="Destinations">
      {NAV.map((d) => {
        const Icon = d.icon
        const current = isActive(d, pathname)
        const h = hints[d.id]
        if (!d.children?.length) {
          return (
            <li key={d.id}>
              <Link to={d.to} aria-current={current ? "page" : undefined} className={cn(TREE_ROW, current ? TREE_FILL : "text-ink-2 hover:bg-raised")}>
                <Icon className={cn("size-[18px] shrink-0", current ? "text-red-light" : "text-faint")} strokeWidth={1.8} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{d.label}</span>
                {h?.hint && <span className={cn("font-mono text-[10px] font-normal", current ? "text-red-light" : "text-faint")}>{h.hint}</span>}
              </Link>
            </li>
          )
        }
        const isOpen = open.has(d.id)
        const fill = current && !isOpen
        return (
          <li key={d.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`tree-${d.id}`}
              onClick={() => setFolder(d.id, !isOpen)}
              onKeyDown={(e) => {
                const to = e.key === "ArrowRight" ? true : e.key === "ArrowLeft" ? false : null
                if (to === null || to === isOpen) return
                e.preventDefault()
                setFolder(d.id, to)
              }}
              className={cn(TREE_ROW, fill ? TREE_FILL : current ? "text-ink hover:bg-raised" : "text-ink-2 hover:bg-raised")}
            >
              <Icon className={cn("size-[18px] shrink-0", fill ? "text-red-light" : current ? "text-red-light" : "text-faint")} strokeWidth={1.8} aria-hidden />
              {/* Counts sit on the pages below, so the label gets the room. */}
              <span className="min-w-0 flex-1 truncate text-left">{d.label}</span>
              <ChevronRight
                className={cn("size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none", isOpen && "rotate-90", fill ? "text-red-light" : "text-faint")}
                aria-hidden
              />
            </button>
            <div
              id={`tree-${d.id}`}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-bw motion-reduce:transition-none",
                isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
              )}
            >
              <ul className="ml-[19px] min-h-0 overflow-hidden border-l border-line pl-2" aria-label={`${d.label} pages`}>
                {d.children.map((c, i) => {
                  const here = activeChild(d, pathname, search) === c
                  const count = h?.subs?.[c.to]
                  return (
                    <li key={c.to} className={cn(i === 0 && "pt-1", i === d.children!.length - 1 && "pb-1")}>
                      <Link
                        to={c.to}
                        aria-current={here ? "page" : undefined}
                        className={cn(
                          "flex h-[var(--bw-nav-row)] items-center gap-2 rounded-[var(--bw-control-radius)] px-2 text-[13px] whitespace-nowrap text-muted-foreground hover:bg-raised hover:text-white",
                          here && "bg-line text-white before:size-1.5 before:shrink-0 before:rounded-[1.5px] before:bg-red before:content-['']",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{c.label}</span>
                        {count && <span className="text-[10px] text-muted-foreground">{count}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
