import { addDays, format, isToday } from "date-fns"
import { CalendarArrowUp, CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ListRow } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
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
    <>
      <PageHeader
        title="Calendar & daily log"
        subtitle="Pick a day to read or write its log. It saves as you type."
        actions={
          <Button variant="outline" size="lg" onClick={() => go(todayKey())} disabled={isToday(day)}>
            <CalendarDays /> Today
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-3 self-start">
          <Panel tool="calendar" command="month" bodyClassName="flex flex-col items-center gap-2 pb-3">
            <JournalCalendar selected={date} onSelect={go} month={month} onMonthChange={setMonth} />
            <CalendarLegend />
          </Panel>
          {recent.length > 0 && (
            <Panel tool="logs" command="recent">
              <ul>
                {recent.map((j) => (
                  <ListRow key={j.id} className="p-0">
                    <Link
                      to={logHref(j.id)}
                      aria-current={j.id === date ? "page" : undefined}
                      className="group/log flex min-w-0 flex-1 items-start gap-2.5 px-3.5 py-2"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-[1.5px] bg-transparent group-aria-[current=page]/log:bg-red" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] text-muted-foreground">{format(parseKey(j.id), "EEE, MMM d")}</span>
                        <span className="block truncate text-[13px] text-ink">{j.text.split("\n")[0]}</span>
                      </span>
                    </Link>
                  </ListRow>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
        <LogEditor key={date} date={date} onNavigate={go} />
      </div>
    </>
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
      <section aria-labelledby="log-day" className="bw-panel flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line py-1.5 pr-2 pl-2">
          <Button variant="quiet" size="icon-sm" aria-label="Previous day" onClick={() => onNavigate(toDateKey(addDays(day, -1)))}>
            <ChevronLeft />
          </Button>
          <h2 id="log-day" className="font-heading text-base font-bold">
            {format(day, "EEEE, MMMM d")}
            {!isToday(day) && <span className="ml-1.5 font-medium text-muted-foreground">{format(day, "yyyy")}</span>}
          </h2>
          <Button variant="quiet" size="icon-sm" aria-label="Next day" onClick={() => onNavigate(toDateKey(addDays(day, 1)))}>
            <ChevronRight />
          </Button>
          {isToday(day) && (
            <span className="inline-flex h-5 items-center gap-1.5 rounded-[5px] border border-rim px-1.5 font-mono text-[10px] tracking-wide text-ink-2 uppercase">
              <span className="size-1.5 rounded-[1.5px] bg-red" aria-hidden /> Today
            </span>
          )}
          <span className="ml-auto pl-2 text-[11px] text-muted-foreground" aria-live="polite" data-testid="log-state">
            {dirty ? "Saving…" : entry ? `Saved ${timeAgo(entry.updatedAt)}` : "Nothing written yet"}
          </span>
          {(entry || text.trim()) && !mode && (
            <>
              <Button variant="quiet" size="icon-sm" aria-label="Move this log to another day" title="Move to another day" onClick={() => setMode("move")}>
                <CalendarArrowUp />
              </Button>
              <Button variant="quiet" size="icon-sm" aria-label="Delete this log" title="Delete log" onClick={() => setMode("delete")}>
                <Trash2 />
              </Button>
            </>
          )}
        </div>
        {mode === "move" && (
          <form
            className="flex flex-wrap items-center gap-2 border-b border-line bg-well/60 px-3.5 py-2 text-xs"
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
            <Input id="move-to" type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 w-40" />
            <span className="text-[11px] text-muted-foreground">If that day has a log, this is added below it.</span>
            <div className="ml-auto flex gap-2">
              <Button type="submit" disabled={!target || target === date}>Move</Button>
              <Button type="button" variant="quiet" onClick={() => setMode(null)}>Cancel</Button>
            </div>
          </form>
        )}
        {mode === "delete" && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-well/60 px-3.5 py-2 text-xs">
            <span className="text-ink-2">Delete the log for {format(day, "MMM d")}?</span>
            <div className="ml-auto flex gap-2">
              <Button
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
              <Button variant="quiet" onClick={() => setMode(null)}>Cancel</Button>
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
          className="min-h-[45vh] rounded-none border-0 bg-transparent px-3.5 py-3 leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel tool="tasks" command="due" meta={due.length}>
          {due.length > 0 && <ul className="border-b border-line-soft">{due.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
          <form onSubmit={addTask} className="flex items-center gap-2.5 px-3.5 py-1.5">
            <Plus className="size-3.5 shrink-0 text-faint" aria-hidden />
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder={`Add a task for ${isToday(day) ? "today" : format(day, "MMM d")}`}
              aria-label="Add a task for this day"
              className="h-8 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint md:text-[13px]"
            />
          </form>
        </Panel>
        <Panel tool="tasks" command="done" meta={doneThatDay.length}>
          {doneThatDay.length ? (
            <ul>{doneThatDay.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          ) : (
            <p className="px-3.5 py-3 text-[11px] text-muted-foreground">Nothing checked off this day.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
