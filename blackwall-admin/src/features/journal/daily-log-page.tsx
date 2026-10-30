import { addDays, format, isToday } from "date-fns"
import { CalendarArrowUp, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { parseKey, timeAgo, toDateKey, todayKey } from "@/lib/dates"
import { useWorkspace } from "@/stores/workspace"
import { TaskRow } from "@/features/work/task-row"
import { compareTasks } from "@/features/work/task-utils"
import { CalendarLegend, JournalCalendar } from "./journal-calendar"

export const logHref = (date: string) => `/work/calendar/${date}`
const VALID = /^\d{4}-\d{2}-\d{2}$/

export function DailyLogPage() {
  const params = useParams()
  const navigate = useNavigate()
  const date = params.date && VALID.test(params.date) ? params.date : todayKey()
  const day = parseKey(date)
  const [month, setMonth] = useState(day)
  const [shownDate, setShownDate] = useState(date)
  if (shownDate !== date) {
    setShownDate(date)
    setMonth(day)
  }
  const go = (d: string) => navigate(logHref(d))

  const journal = useWorkspace((s) => s.journal)
  const recent = [...journal].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 8)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-3 self-start">
        <section aria-label="Calendar" className="brutal rounded-xl bg-card py-1">
          <div className="flex justify-center">
            <JournalCalendar selected={date} onSelect={go} month={month} onMonthChange={setMonth} />
          </div>
          <CalendarLegend />
          <div className="px-3 pt-2 pb-1">
            <Button size="sm" variant="outline" className="w-full" onClick={() => go(todayKey())} disabled={isToday(day)}>
              Today
            </Button>
          </div>
        </section>
        {recent.length > 0 && (
          <section aria-labelledby="recent-logs" className="brutal rounded-xl bg-card">
            <h2 id="recent-logs" className="eyebrow border-b-2 border-edge bg-recessed/70 px-3 py-2">Recent logs</h2>
            <ul className="py-1">
              {recent.map((j) => (
                <li key={j.id}>
                  <Link
                    to={logHref(j.id)}
                    aria-current={j.id === date ? "page" : undefined}
                    className="block px-3 py-1.5 text-sm hover:bg-muted/40 aria-[current=page]:text-amber"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{format(parseKey(j.id), "EEE MMM d")}</span>
                    <span className="block truncate">{j.text.split("\n")[0]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
      <LogEditor key={date} date={date} onNavigate={go} />
    </div>
  )
}

function LogEditor({ date, onNavigate }: { date: string; onNavigate: (d: string) => void }) {
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === date))
  const saveJournal = useWorkspace((s) => s.saveJournal)
  const moveJournal = useWorkspace((s) => s.moveJournal)
  const [mode, setMode] = useState<null | "move" | "delete">(null)
  const [target, setTarget] = useState(todayKey())
  const tasks = useWorkspace((s) => s.tasks)
  const create = useWorkspace((s) => s.create)
  const [text, setText] = useState(entry?.text ?? "")
  const [quick, setQuick] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)
  const day = parseKey(date)
  const dirty = text !== (entry?.text ?? "")

  // Set once the log has been moved away, so nothing re-saves it here.
  const moved = useRef(false)

  // Autosave shortly after typing stops, and on leaving the page.
  useEffect(() => {
    if (!dirty || moved.current) return
    const t = window.setTimeout(() => saveJournal(date, text), 600)
    return () => window.clearTimeout(t)
  }, [text, dirty, date, saveJournal])
  const latest = useRef({ text, dirty })
  latest.current = { text, dirty }
  useEffect(() => () => void (latest.current.dirty && !moved.current && saveJournal(date, latest.current.text)), [date, saveJournal])

  useEffect(() => {
    if (isToday(day) || !entry) ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const due = tasks.filter((t) => t.due === date && !t.done).sort(compareTasks)
  const doneThatDay = tasks.filter((t) => t.done && t.completedAt && toDateKey(new Date(t.completedAt)) === date)

  const addTask = (e: FormEvent) => {
    e.preventDefault()
    if (!quick.trim()) return
    create("tasks", { title: quick.trim(), due: date, starred: false, done: false })
    setQuick("")
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section aria-label="Daily log" className="flex flex-col brutal rounded-xl bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-edge bg-recessed/70 px-3 py-2">
          <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={() => onNavigate(toDateKey(addDays(day, -1)))}>
            <ChevronLeft />
          </Button>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            {format(day, "EEEE, MMMM d")}
            {!isToday(day) && <span className="ml-2 font-normal text-muted-foreground">{format(day, "yyyy")}</span>}
          </h1>
          <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={() => onNavigate(toDateKey(addDays(day, 1)))}>
            <ChevronRight />
          </Button>
          {isToday(day) && <span className="rounded-sm border border-amber/50 px-1.5 text-xs text-amber">Today</span>}
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite" data-testid="log-state">
            {dirty ? "Saving…" : entry ? `Saved ${timeAgo(entry.updatedAt)}` : "Nothing written yet"}
          </span>
          {(entry || text.trim()) && !mode && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label="Move this log to another day" title="Move to another day" onClick={() => setMode("move")}>
                <CalendarArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete this log" title="Delete log" className="hover:text-red-text" onClick={() => setMode("delete")}>
                <Trash2 />
              </Button>
            </>
          )}
        </div>
        {mode === "move" && (
          <form
            className="flex flex-wrap items-center gap-2 border-b bg-recessed/50 px-3 py-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault()
              saveJournal(date, text)
              moveJournal(date, target)
              moved.current = true
              setMode(null)
              toast.success(`Moved to ${format(parseKey(target), "EEE, MMM d")}`)
              onNavigate(target)
            }}
          >
            <label htmlFor="move-to">Move this log to</label>
            <Input id="move-to" type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="h-7 w-40" />
            <span className="text-xs text-muted-foreground">If that day has a log, this is added below it.</span>
            <div className="ml-auto flex gap-1">
              <Button type="submit" size="sm" disabled={!target || target === date}>Move</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            </div>
          </form>
        )}
        {mode === "delete" && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-recessed/50 px-3 py-2 text-sm">
            <span className="text-red-text">Delete the log for {format(day, "MMM d")}?</span>
            <div className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  const old = text
                  setText("")
                  saveJournal(date, "")
                  setMode(null)
                  toast("Log deleted", { action: { label: "Undo", onClick: () => { setText(old); saveJournal(date, old) } } })
                }}
              >
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            </div>
          </div>
        )}
        <label htmlFor="daily-log" className="sr-only">Log for {format(day, "MMMM d")}</label>
        <Textarea
          id="daily-log"
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"What happened today? What did you learn? What's next?\n\nIt saves automatically."}
          className="min-h-[45vh] rounded-none border-0 bg-transparent px-4 py-3 leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-labelledby="due-heading" className="brutal rounded-xl bg-card">
          <h2 id="due-heading" className="eyebrow border-b-2 border-edge bg-recessed/70 px-3 py-2">Due this day · {due.length}</h2>
          {due.length > 0 && <ul>{due.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
          <form onSubmit={addTask} className="flex items-center gap-2 px-3 py-2">
            <Plus className="size-4 text-muted-foreground" aria-hidden />
            <Input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder={`Add a task for ${isToday(day) ? "today" : format(day, "MMM d")}`}
              aria-label="Add a task for this day"
              className="h-7 border-transparent bg-transparent px-1 dark:bg-transparent"
            />
          </form>
        </section>
        <section aria-labelledby="done-heading" className="brutal rounded-xl bg-card">
          <h2 id="done-heading" className="eyebrow border-b-2 border-edge bg-recessed/70 px-3 py-2">Completed this day · {doneThatDay.length}</h2>
          {doneThatDay.length ? (
            <ul>{doneThatDay.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">Nothing checked off.</p>
          )}
        </section>
      </div>
    </div>
  )
}
