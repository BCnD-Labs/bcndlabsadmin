import { isToday, isYesterday, parseISO } from "date-fns"
import { useEffect, useId, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { DrainBar } from "@/components/common/drain-bar"
import { NoSignal } from "@/components/common/no-signal"
import { Prompt } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { useAutoHide } from "@/hooks/use-auto-hide"
import { shortAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useNotifications, type BwNotification, type NotificationKind } from "@/services/notifications"

type Filter = "all" | NotificationKind

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "alerts", label: "Alerts" },
  { value: "dev", label: "Dev" },
  { value: "site", label: "Site" },
]

const ICON: Record<NotificationKind, { path: string; color: string }> = {
  alerts: { path: "M12 3l10 18H2zM12 10v4M12 17h.01", color: "var(--bw-red)" },
  dev: { path: "M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9c0 6-12 3-12 9", color: "var(--bw-text-2)" },
  site: { path: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18", color: "var(--bw-text-2)" },
}

function groupLabel(n: BwNotification) {
  const d = parseISO(n.at)
  return isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : "Earlier"
}

/**
 * Bell + floating notifications card (spec §4): slides in from the right over the
 * page with no dimming or layout shift, and auto-hides like the calendar.
 */
export function Notifications() {
  const items = useNotifications((s) => s.items)
  const markRead = useNotifications((s) => s.markRead)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const buttonRef = useRef<HTMLButtonElement>(null)
  const cardId = useId()
  const hide = useAutoHide(open, () => setOpen(false))
  const { disarm } = hide
  const unread = items.filter((n) => !n.read).length

  const close = () => {
    disarm()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      disarm()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, disarm])

  const shown = [...items]
    .filter((n) => filter === "all" || n.kind === filter)
    .sort((a, b) => b.at.localeCompare(a.at))
  const groups = (["Today", "Yesterday", "Earlier"] as const)
    .map((label) => ({ label, items: shown.filter((n) => groupLabel(n) === label) }))
    .filter((g) => g.items.length)

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={cardId}
        onClick={() => {
          disarm()
          setOpen(!open)
        }}
        className="relative"
      >
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 21h4" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden
            data-testid="unread-badge"
            className="absolute -top-[5px] -right-[5px] flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-red px-1 text-[9px] font-bold text-white"
          >
            {unread}
          </span>
        )}
      </Button>

      <aside
        id={cardId}
        aria-label="Notifications"
        data-open={open}
        aria-hidden={!open}
        inert={!open}
        onPointerEnter={hide.onPointerEnter}
        onPointerLeave={hide.onPointerLeave}
        className="bw-panel bw-float bw-slide fixed top-3 right-3 bottom-3 z-50 flex w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden"
      >
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line pr-2 pl-3.5">
          <span className="flex items-center gap-2">
            <Prompt>notifications</Prompt>
            <span
              className={cn(
                "min-w-[18px] rounded-[4px] px-[5px] text-center text-[10px] text-white tabular-nums",
                unread ? "bg-red" : "bg-[#3A3D43]",
              )}
            >
              {unread}
            </span>
          </span>
          <div className="flex gap-1">
            {items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} disabled={!unread}>
                read all
              </Button>
            )}
            <Button variant="ghost" size="icon-xs" aria-label="Hide notifications" onClick={close}>
              ✕
            </Button>
          </div>
        </div>
        {hide.leaving && <DrainBar seconds={hide.seconds} />}

        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <NoSignal message="No notification sources connected." onNavigate={close} />
          </div>
        ) : (
          <>
            <div className="px-3 pt-2.5 pb-1.5">
              <SegmentedTabs tabs={FILTERS} value={filter} onChange={setFilter} label="Filter notifications" tabClassName="h-[26px] rounded-[6px]" />
            </div>
            <div className="flex flex-1 flex-col overflow-auto px-1.5 pt-1 pb-2">
              {groups.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">Nothing here.</p>}
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label} className="flex flex-col">
                  <h3 className="eyebrow px-2 pt-2.5 pb-1.5">{g.label}</h3>
                  {g.items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n.id)}
                      aria-label={`${n.title}${n.read ? "" : ", unread"}`}
                      className="grid w-full grid-cols-[30px_minmax(0,1fr)_8px] items-start gap-2.5 rounded-[8px] px-2 py-[9px] text-left hover:bg-[#1A1B1E]"
                    >
                      <span className="flex size-[30px] items-center justify-center rounded-[7px] border-r-2 border-b-2 border-ledge bg-raised">
                        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ICON[n.kind].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={ICON[n.kind].path} />
                        </svg>
                      </span>
                      <span className="flex min-w-0 flex-col gap-[3px]">
                        <span className={cn("text-xs", n.read ? "text-ink-2" : "font-semibold text-white")}>{n.title}</span>
                        <span className="text-[11px] leading-[1.45] text-muted-foreground">{n.body}</span>
                        <span className="text-[10px] text-faint">
                          {n.source} · {shortAgo(n.at)}
                        </span>
                      </span>
                      <span aria-hidden className={cn("mt-[5px] size-[7px] rounded-[2px]", !n.read && "bg-red")} />
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}

        <div className="flex shrink-0 justify-between border-t border-line px-3.5 py-2.5 text-[10px] text-muted-foreground">
          <span>auto-hides {hide.seconds}s after mouse leaves</span>
          <Link to="/settings/appearance" onClick={close} className="text-ink-2 hover:text-ink">
            settings →
          </Link>
        </div>
      </aside>
    </>
  )
}
