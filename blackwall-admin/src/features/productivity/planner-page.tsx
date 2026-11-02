import { addDays, format, isToday } from "date-fns"
import { ChevronLeft, ChevronRight, ListChecks, Pin, PinOff, Plus, Search, Star, StickyNote, X } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ListGroupLabel } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { CourseTag } from "@/features/learning/coursework"
import { NOTE_COLORS, noteColor, noteTitle } from "@/features/notes/note-colors"
import { CalendarLegend, JournalCalendar } from "@/features/journal/journal-calendar"
import { TaskRow } from "@/features/work/task-row"
import { GROUP_ORDER, compareTasks, groupOf, type TaskGroup } from "@/features/work/task-utils"
import { daysUntil, parseKey, shortAgo, timeAgo, toDateKey, todayKey } from "@/lib/dates"
import { parseQuickAdd } from "@/lib/quick-add"
import { logHref } from "@/lib/routes"
import type { Note, NoteColor, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Productivity → Planner: tasks, the calendar with each day's agenda and log,
 * and notes, side by side. On wide screens the page fits the window and each
 * column scrolls on its own; narrower screens stack them.
 */
export function PlannerPage() {
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const openForm = useUi((s) => s.openForm)
  const tasks = useWorkspace((s) => s.tasks)
  const date = params.get("date") && VALID_DAY.test(params.get("date")!) ? params.get("date")! : todayKey()

  // ?note=<id> (search results, old Notes links) opens that note.
  const noteParam = params.get("note")
  useEffect(() => {
    if (!noteParam) return
    if (useWorkspace.getState().notes.some((n) => n.id === noteParam)) openForm({ kind: "note", id: noteParam })
    const next = new URLSearchParams(params)
    next.delete("note")
    setParams(next, { replace: true })
  }, [noteParam, params, setParams, openForm])

  // #day / #notes: bring that column into view where columns stack.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
  }, [hash])

  const overdue = tasks.filter((t) => !t.done && t.due && daysUntil(t.due) < 0).length
  const today = tasks.filter((t) => !t.done && t.due === todayKey()).length

  return (
    <>
      <PageHeader
        title="Planner"
        subtitle={
          <>
            {format(new Date(), "EEEE, MMMM d")} · {today} due today
            {overdue > 0 && <span className="text-amber"> · {overdue} overdue</span>}
          </>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => openForm({ kind: "note" })}>
              <StickyNote /> Note
            </Button>
            <Button onClick={() => openForm({ kind: "task" })}>
              <Plus /> Task
            </Button>
          </>
        }
      />
      <div
        className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] xl:h-[calc(100dvh-var(--bw-header-h,92px)-5.25rem)] xl:min-h-[34rem] xl:grid-cols-[minmax(0,1.1fr)_19.5rem_minmax(0,1fr)]"
        data-testid="planner"
      >
        <TasksCard />
        <DayColumn date={date} onDate={(d) => navigate(logHref(d), { replace: true })} />
        <NotesCard />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ tasks */

type TaskTab = "today" | "upcoming" | "all" | "done"

const inTab = (t: Task, tab: TaskTab) => {
  if (tab === "done") return t.done
  if (t.done) return false
  if (tab === "today") return !!t.due && daysUntil(t.due) <= 0
  if (tab === "upcoming") return !!t.due && daysUntil(t.due) > 0
  return true
}

const TAB_GROUPS: Record<Exclude<TaskTab, "done">, TaskGroup[]> = {
  today: ["Overdue", "Today"],
  upcoming: ["Tomorrow", "Next 7 days", "Later"],
  all: GROUP_ORDER,
}

function TasksCard() {
  const tasks = useWorkspace((s) => s.tasks)
  const create = useWorkspace((s) => s.create)
  const [tab, setTab] = useState<TaskTab>("today")
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)
  const [starred, setStarred] = useState(false)
  const [quick, setQuick] = useState("")
  // Checked off here: stays visible (struck through) until the tab changes.
  const [lingering, setLingering] = useState<Set<string>>(new Set())

  const match = (t: Task) => {
    const needle = q.trim().toLowerCase()
    return (!needle || t.title.toLowerCase().includes(needle) || !!t.details?.toLowerCase().includes(needle)) && (!starred || t.starred)
  }
  const rows = useMemo(
    () => tasks.filter((t) => (inTab(t, tab) || lingering.has(t.id)) && match(t)).sort(compareTasks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, tab, lingering, q, starred],
  )
  const count = (k: TaskTab) => tasks.filter((t) => inTab(t, k)).length
  const changeTab = (t: TaskTab) => {
    setTab(t)
    setLingering(new Set())
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!quick.trim()) return
    const parsed = parseQuickAdd(quick)
    // In Today, an undated task is for today; elsewhere it stays undated.
    const due = parsed.due ?? (tab === "today" ? todayKey() : undefined)
    create("tasks", { title: parsed.title, due, starred, done: false })
    setQuick("")
    if (tab === "done" || (tab === "upcoming" && (!due || daysUntil(due) <= 0))) changeTab(due && daysUntil(due) <= 0 ? "today" : "all")
  }

  const onToggle = (t: Task) => {
    if (!t.done) setLingering((s) => new Set(s).add(t.id))
  }

  const groups =
    tab === "done"
      ? [{ name: null as TaskGroup | null, items: rows }]
      : TAB_GROUPS[tab].map((g) => ({ name: g as TaskGroup | null, items: rows.filter((t) => groupOf(t) === g || (lingering.has(t.id) && t.done && g === TAB_GROUPS[tab][0])) })).filter((g) => g.items.length)

  return (
    <Panel
      id="tasks"
      tool="tasks"
      command={tab}
      meta={`${count("all")} open`}
      className="min-h-[24rem] xl:min-h-0"
      bodyClassName="flex min-h-0 flex-col"
      actions={
        <>
          <Button
            variant="quiet"
            size="icon-sm"
            aria-label="Search tasks"
            aria-pressed={searching}
            onClick={() => {
              setSearching(!searching)
              if (searching) setQ("")
            }}
          >
            <Search />
          </Button>
          <Button variant="quiet" size="icon-sm" aria-label="Starred only" aria-pressed={starred} onClick={() => setStarred(!starred)}>
            <Star className={cn(starred && "fill-current text-amber")} />
          </Button>
        </>
      }
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-3 py-2.5">
        <SegmentedTabs
          label="Task views"
          idBase="planner-tasks"
          value={tab}
          onChange={changeTab}
          tabs={[
            { value: "today", label: "Today", count: count("today") },
            { value: "upcoming", label: "Upcoming", count: count("upcoming") },
            { value: "all", label: "All", count: count("all") },
            { value: "done", label: "Done" },
          ]}
        />
        {searching && (
          <label className="flex h-8 items-center gap-2 rounded-[7px] border border-rim bg-well px-2.5">
            <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none md:text-[13px]"
              onKeyDown={(e) => e.key === "Escape" && (setQ(""), setSearching(false))}
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="text-faint hover:text-ink">
                <X className="size-3.5" />
              </button>
            )}
          </label>
        )}
        <form onSubmit={add} className="flex h-8 items-center gap-2 rounded-[7px] border border-dashed border-ledge-hi bg-well px-2.5 focus-within:border-solid focus-within:border-rim">
          <Plus className="size-3.5 shrink-0 text-faint" aria-hidden />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder={tab === "today" ? "Add a task for today" : "Add a task"}
            title="End with a day (“fri”, “tomorrow”) to set the date"
            aria-label="Add a task"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint md:text-[13px]"
          />
        </form>
      </div>
      <div id="planner-tasks-panel" role="tabpanel" aria-labelledby={`planner-tasks-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
        {rows.length ? (
          groups.map((g) => (
            <section key={g.name ?? "done"} aria-label={g.name ?? "Completed"}>
              {g.name && (tab !== "today" || groups.length > 1) && (
                <ListGroupLabel tone={g.name === "Overdue" ? "warn" : undefined} className="px-3 py-1">
                  {g.name} <span className="text-faint">· {g.items.length}</span>
                </ListGroupLabel>
              )}
              <ul>
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} dense onToggle={onToggle} />
                ))}
              </ul>
            </section>
          ))
        ) : q || starred ? (
          <EmptyState title="No tasks match" action={<Button variant="outline" size="sm" onClick={() => (setQ(""), setStarred(false))}>Clear filters</Button>} />
        ) : (
          <EmptyState icon={ListChecks} title={{ today: "Nothing due today", upcoming: "Nothing scheduled", all: "No open tasks", done: "Nothing completed yet" }[tab]}>
            {tab === "done" ? "Checked-off tasks land here." : "Type one in the line above and press Enter."}
          </EmptyState>
        )}
      </div>
    </Panel>
  )
}

/* -------------------------------------------------------- calendar + day */

function DayColumn({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const day = parseKey(date)
  const [month, setMonth] = useState(day)
  const [shown, setShown] = useState(date)
  if (shown !== date) {
    setShown(date)
    setMonth(day)
  }
  return (
    <div id="day" className="flex min-h-0 min-w-0 scroll-mt-28 flex-col gap-3">
      <section aria-label="Calendar" className="bw-panel flex shrink-0 flex-col items-center gap-1.5 pt-1.5 pb-2.5">
        <JournalCalendar selected={date} onSelect={onDate} month={month} onMonthChange={setMonth} className="[--cell-size:--spacing(8)]" />
        <CalendarLegend />
      </section>
      <DayCard key={date} date={date} onDate={onDate} />
    </div>
  )
}

function DayCard({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const day = parseKey(date)
  const tasks = useWorkspace((s) => s.tasks)
  const create = useWorkspace((s) => s.create)
  const due = tasks.filter((t) => t.due === date && !t.done).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || compareTasks(a, b))
  const doneThatDay = tasks.filter((t) => t.done && t.completedAt && toDateKey(new Date(t.completedAt)) === date)
  const [quick, setQuick] = useState("")

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!quick.trim()) return
    create("tasks", { title: quick.trim(), due: date, starred: false, done: false })
    setQuick("")
  }

  return (
    <section aria-labelledby="planner-day" className="bw-panel flex min-h-[20rem] flex-1 flex-col overflow-hidden xl:min-h-0">
      <header className="flex h-10 shrink-0 items-center gap-1 border-b border-line pr-1.5 pl-1.5">
        <Button variant="quiet" size="icon-sm" aria-label="Previous day" onClick={() => onDate(toDateKey(addDays(day, -1)))}>
          <ChevronLeft />
        </Button>
        <h2 id="planner-day" className="min-w-0 truncate font-sans text-[13px] font-semibold text-ink">
          {format(day, "EEE, MMM d")}
          {day.getFullYear() !== new Date().getFullYear() && <span className="ml-1 font-normal text-muted-foreground">{format(day, "yyyy")}</span>}
        </h2>
        <Button variant="quiet" size="icon-sm" aria-label="Next day" onClick={() => onDate(toDateKey(addDays(day, 1)))}>
          <ChevronRight />
        </Button>
        {isToday(day) ? (
          <span className="ml-auto inline-flex h-5 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase">
            <span className="size-1.5 rounded-[1.5px] bg-red" aria-hidden /> Today
          </span>
        ) : (
          <Button variant="outline" size="xs" className="ml-auto" onClick={() => onDate(todayKey())}>
            Today
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h3 className="bw-label flex items-center justify-between px-3 pt-2.5 pb-1">
          Due <span className="text-faint normal-case tracking-normal">{due.length || ""}</span>
        </h3>
        {due.length > 0 && (
          <ul className="border-b border-line-soft">
            {due.map((t) => (
              <TaskRow key={t.id} task={t} dense hideDate />
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex items-center gap-2 border-b border-line-soft px-3 py-1">
          <Plus className="size-3.5 shrink-0 text-faint" aria-hidden />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder={`Add for ${isToday(day) ? "today" : format(day, "MMM d")}`}
            aria-label="Add a task for this day"
            className="h-7 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint md:text-[13px]"
          />
        </form>
        {doneThatDay.length > 0 && (
          <p className="border-b border-line-soft px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="text-green">✓</span> {doneThatDay.length} completed this day
          </p>
        )}
        <DailyLog date={date} />
      </div>
    </section>
  )
}

/** The day's log: saves shortly after typing stops, and when leaving the day. */
function DailyLog({ date }: { date: string }) {
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === date))
  const saveJournal = useWorkspace((s) => s.saveJournal)
  const [text, setText] = useState(entry?.text ?? "")
  const ref = useRef<HTMLTextAreaElement>(null)
  const dirty = text !== (entry?.text ?? "")

  useEffect(() => {
    if (!dirty) return
    const t = window.setTimeout(() => saveJournal(date, text), 600)
    return () => window.clearTimeout(t)
  }, [text, dirty, date, saveJournal])
  const latest = useRef({ text, dirty })
  useEffect(() => {
    latest.current = { text, dirty }
  })
  useEffect(() => () => void (latest.current.dirty && saveJournal(date, latest.current.text)), [date, saveJournal])

  // Grow with the text.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(el.scrollHeight, 128)}px`
  }, [text])

  return (
    <div className="flex flex-col px-3 pt-2.5 pb-3">
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor="planner-log" className="bw-label">Daily log</label>
        <span className="text-[10px] text-faint" aria-live="polite" data-testid="log-state">
          {dirty ? "Saving…" : entry ? `Saved ${timeAgo(entry.updatedAt)}` : ""}
        </span>
      </div>
      <textarea
        id="planner-log"
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What happened? What did you learn? What's next?"
        className="w-full resize-none rounded-[7px] border border-line-soft bg-well px-2.5 py-2 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-rim md:text-[13px]"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ notes */

function NotesCard() {
  const notes = useWorkspace((s) => s.notes)
  const create = useWorkspace((s) => s.create)
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)
  const [quick, setQuick] = useState("")
  const [color, setColor] = useState<NoteColor>("plain")

  const { pinned, others } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = notes.filter((n) => !needle || n.text.toLowerCase().includes(needle)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return { pinned: list.filter((n) => n.pinned), others: list.filter((n) => !n.pinned) }
  }, [notes, q])

  const add = () => {
    if (!quick.trim()) return
    create("notes", { text: quick.trim(), color, pinned: false })
    setQuick("")
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      add()
    }
  }

  return (
    <Panel
      id="notes"
      tool="notes"
      command={q ? `grep "${q}"` : "ls"}
      meta={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
      className="min-h-[24rem] scroll-mt-28 lg:col-span-2 xl:col-span-1 xl:min-h-0"
      bodyClassName="flex min-h-0 flex-col"
      actions={
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label="Search notes"
          aria-pressed={searching}
          onClick={() => {
            setSearching(!searching)
            if (searching) setQ("")
          }}
        >
          <Search />
        </Button>
      }
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-3 py-2.5">
        {searching && (
          <label className="flex h-8 items-center gap-2 rounded-[7px] border border-rim bg-well px-2.5">
            <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none md:text-[13px]"
              onKeyDown={(e) => e.key === "Escape" && (setQ(""), setSearching(false))}
            />
          </label>
        )}
        <div className="rounded-[7px] border border-dashed border-ledge-hi bg-well focus-within:border-solid focus-within:border-rim">
          <label htmlFor="planner-quick-note" className="sr-only">New note</label>
          <textarea
            id="planner-quick-note"
            rows={quick.includes("\n") ? 3 : 1}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={onKey}
            placeholder="Take a note…"
            title="Enter saves; Shift+Enter starts a new line"
            className="block w-full resize-none bg-transparent px-2.5 py-[7px] text-base leading-snug text-ink outline-none placeholder:text-faint md:text-[13px]"
          />
          {quick.trim() && (
            <div className="flex items-center gap-2 border-t border-line-soft px-2 py-1.5">
              <div role="radiogroup" aria-label="Note colour" className="flex items-center gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={color === c.value}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => setColor(c.value)}
                    className={cn("size-4 rounded-full", c.swatch, color === c.value && "ring-2 ring-ink-2 ring-offset-2 ring-offset-well")}
                  />
                ))}
              </div>
              <Button size="xs" className="ml-auto" onClick={add}>Add note</Button>
            </div>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {pinned.length + others.length === 0 ? (
          <EmptyState icon={StickyNote} title={q ? "No notes match" : "No notes yet"} className="py-8">
            {q ? "Try a different search." : "Pinned notes also show on Home."}
          </EmptyState>
        ) : (
          <>
            {pinned.length > 0 && <NoteGroup label="Pinned" notes={pinned} />}
            {others.length > 0 && <NoteGroup label={pinned.length ? "Others" : "All notes"} notes={others} />}
          </>
        )}
      </div>
    </Panel>
  )
}

function NoteGroup({ label, notes }: { label: string; notes: Note[] }) {
  return (
    <section className="mb-3 last:mb-0" aria-label={label}>
      <h3 className="bw-label mb-1.5">
        {label} <span className="text-faint">· {notes.length}</span>
      </h3>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </ul>
    </section>
  )
}

/** A compact note: colour edge, first line as the title, a short preview. Click to edit. */
export function NoteCard({ note }: { note: Note }) {
  const openForm = useUi((s) => s.openForm)
  const togglePin = useWorkspace((s) => s.togglePin)
  const course = useWorkspace((s) => (note.courseId ? s.courses.find((c) => c.id === note.courseId) : undefined))
  const title = noteTitle(note.text)
  const rest = note.text.trim().split("\n").slice(1).join(" ").trim()
  return (
    <li className="group relative" data-testid="planner-note">
      <button
        type="button"
        onClick={() => openForm({ kind: "note", id: note.id })}
        className="flex h-full w-full flex-col gap-1 overflow-hidden rounded-[8px] border border-line bg-raised py-2 pr-2.5 pl-3 text-left transition-colors hover:border-rim hover:bg-selected"
      >
        <span className={cn("absolute inset-y-0 left-0 w-[3px] rounded-l-[8px]", noteColor(note.color).swatch)} aria-hidden />
        <span className="truncate pr-6 text-[13px] font-semibold text-ink">{title}</span>
        {rest && <span className="line-clamp-3 text-xs leading-[1.5] text-muted-foreground">{rest}</span>}
        <span className="mt-auto flex items-center gap-1.5 pt-0.5 text-[10px] text-faint">
          {course && <CourseTag course={course} asLink={false} className="h-4 px-1.5 text-[10px]" />}
          {shortAgo(note.updatedAt)}
        </span>
      </button>
      <button
        type="button"
        aria-label={note.pinned ? `Unpin "${title}"` : `Pin "${title}"`}
        title={note.pinned ? "Unpin from Home" : "Pin to Home"}
        onClick={() => {
          togglePin(note.id)
          toast(note.pinned ? "Unpinned" : "Pinned to Home")
        }}
        className={cn(
          "absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-[6px] text-faint hover:bg-ledge hover:text-ink",
          note.pinned ? "text-ink-2" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        {note.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
    </li>
  )
}
