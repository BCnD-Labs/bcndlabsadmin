import { format, isSameMonth, isToday } from "date-fns"
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react"
import type { DayButtonProps } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { CountdownBorder } from "@/components/common/countdown-border"
import { Prompt } from "@/components/common/panel"
import { useAutoHide } from "@/hooks/use-auto-hide"
import { useNow } from "@/hooks/use-now"
import { toDateKey } from "@/lib/dates"
import type { DateKey } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { LogDialog } from "@/features/journal/log-dialog"

const LOG_DOT = "var(--bw-check)"

const DotsContext = createContext(new Map<DateKey, Set<string>>())

/** Per-day dots: open tasks due (red), overdue (amber), a saved log (grey). */
function useDayDots(today: DateKey) {
  const tasks = useWorkspace((s) => s.tasks)
  const journal = useWorkspace((s) => s.journal)
  return useMemo(() => {
    const map = new Map<DateKey, Set<string>>()
    const add = (k: DateKey, c: string) => map.set(k, (map.get(k) ?? new Set()).add(c))
    for (const t of tasks) if (!t.done && t.due) add(t.due, t.due < today ? "amber" : "red")
    for (const j of journal) add(j.id, "log")
    return map
  }, [tasks, journal, today])
}

function CalIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" />
    </svg>
  )
}

/** A day cell: the date plus up to three 3px dots. Outside days are disabled. */
function DayButton({ day, modifiers, className: _c, ...props }: DayButtonProps) {
  const dots = useContext(DotsContext)
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])
  const date = day.date
  const outside = !isSameMonth(date, day.displayMonth)
  const today = isToday(date)
  const set = outside ? undefined : dots.get(toDateKey(date))
  const colors = set ? (["red", "amber", "log"] as const).filter((c) => set.has(c)) : []
  const fill = { red: "var(--bw-red)", amber: "var(--bw-amber)", log: LOG_DOT }
  const parts = [
    colors.includes("red") && "tasks due",
    colors.includes("amber") && "overdue tasks",
    colors.includes("log") && "log saved",
  ].filter(Boolean)
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      disabled={outside}
      aria-label={outside ? undefined : `${format(date, "MMMM d")}${parts.length ? `, ${parts.join(", ")}` : ""}, open log`}
      className={cn(
        "flex h-[30px] w-full flex-col items-center justify-center gap-[2px] rounded-[6px] p-0 text-xs tabular-nums",
        today ? "bg-red font-semibold text-white" : outside ? "text-faint" : "text-ink-2 hover:bg-raised",
        outside && "cursor-default",
      )}
    >
      {date.getDate()}
      <span className="flex h-[3px] gap-[2px]" aria-hidden>
        {colors.map((c) => (
          <span key={c} className="size-[3px] rounded-[1px]" style={{ background: today ? "#fff" : fill[c] }} />
        ))}
      </span>
    </button>
  )
}

/**
 * Header calendar (spec §4): a ghost "Oct 30" button with a floating card for the
 * month and today's tasks. Hovering the button opens the card and leaving closes
 * it straight away; clicking pins it open (the button gets a red outline), and
 * after the pointer leaves that outline retracts as the auto-hide countdown. Clicking a day opens that day's log.
 */
export function CalendarMenu() {
  const now = useNow()
  const [mode, setMode] = useState<null | "hover" | "pinned">(null)
  const open = mode !== null
  const [logDate, setLogDate] = useState<DateKey | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const cardId = useId()
  const todayK = toDateKey(now)
  const dots = useDayDots(todayK)
  const tasks = useWorkspace((s) => s.tasks)
  const dueToday = tasks.filter((t) => !t.done && t.due === todayK)

  const hide = useAutoHide(mode === "pinned", () => setMode(null))
  const { disarm } = hide
  const close = () => {
    disarm()
    setMode(null)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || logDate) return
      disarm()
      setMode(null)
      buttonRef.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, logDate, disarm])

  const pick = (d: Date) => {
    close()
    setLogDate(toDateKey(d))
  }

  return (
    <>
      {/* The button and the card share one hover area (the card's top padding bridges the gap). */}
      <div
        className="relative"
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return
          if (mode === null) setMode("hover")
          else hide.onPointerEnter(e)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return
          if (mode === "hover") setMode(null)
          else hide.onPointerLeave(e)
        }}
      >
        <Button
          ref={buttonRef}
          variant="ghost"
          size="lg"
          aria-label={`Calendar, ${format(now, "MMMM d")}${dueToday.length ? `, ${dueToday.length} due today` : ""}`}
          aria-expanded={open}
          aria-controls={cardId}
          aria-pressed={mode === "pinned"}
          className="relative"
          onClick={() => {
            disarm()
            setMode(mode === "pinned" ? null : "pinned")
          }}
        >
          {/* Pinned: a red outline on the button that retracts as the auto-hide countdown. */}
          <CountdownBorder active={mode === "pinned"} draining={hide.leaving} seconds={hide.seconds} radius={8} className="-inset-px size-[calc(100%+2px)]" />
          <CalIcon className="text-ink-2" />
          <span>{format(now, "MMM d")}</span>
          {dueToday.length > 0 && <span aria-hidden className="size-1.5 rounded-[1.5px] bg-amber" data-testid="due-today-marker" />}
        </Button>

        <div
          id={cardId}
          data-open={open}
          data-mode={mode ?? undefined}
          aria-hidden={!open}
          inert={!open}
          className="bw-pop absolute top-full left-0 z-40 w-[300px] max-w-[calc(100vw-48px)] pt-2.5"
        >
          <section aria-label="Calendar" className="bw-panel bw-float overflow-hidden">
            <div className="flex h-10 items-center justify-between gap-2 border-b border-line pr-2 pl-3.5">
              <Prompt tool="cal" command={format(now, "MMM yyyy")} />
              {mode === "pinned" ? (
                <Button variant="quiet" size="sm" aria-label="Close calendar" onClick={close}>
                  hide
                </Button>
              ) : (
                <span className="pr-1.5 text-[10px] text-faint">click to pin</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-3">
              <DotsContext.Provider value={dots}>
                <Calendar
                  month={now}
                  hideNavigation
                  showOutsideDays
                  onDayClick={(d, m) => !m.outside && pick(d)}
                  formatters={{ formatWeekdayName: (d) => format(d, "EEEEEE").toUpperCase() }}
                  labels={{ labelGrid: (d) => format(d, "MMMM yyyy") }}
                  className="w-full bg-transparent p-0"
                  classNames={{
                    root: "w-full",
                    months: "relative flex flex-col",
                    month: "flex w-full flex-col gap-1.5",
                    month_caption: "sr-only",
                    month_grid: "w-full",
                    weekdays: "grid grid-cols-7 gap-[2px]",
                    weekday: "text-center text-[10px] font-semibold tracking-[0.04em] text-faint",
                    week: "mt-[2px] grid grid-cols-7 gap-[2px]",
                    day: "p-0",
                    today: "",
                    outside: "",
                    disabled: "",
                  }}
                  components={{ DayButton }}
                />
              </DotsContext.Provider>
              <div className="flex flex-col gap-1.5 border-t border-dashed border-line pt-2.5">
                <div className="flex justify-between">
                  <span className="bw-label">Today</span>
                  <span className="text-[10px] text-faint">click a day → log</span>
                </div>
                {dueToday.length ? (
                  <ul className="flex flex-col gap-1.5" aria-label="Tasks due today">
                    {dueToday.map((t) => (
                      <li key={t.id} className="grid grid-cols-[8px_minmax(0,1fr)] items-center gap-2 text-[11px]">
                        <span aria-hidden className="size-1.5 rounded-[1.5px] bg-red" />
                        <span className="truncate text-ink">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Nothing due today.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <LogDialog
        date={logDate}
        onOpenChange={(o) => !o && setLogDate(null)}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          buttonRef.current?.focus()
        }}
      />
    </>
  )
}
