import { CategoryIcon, type Category } from "@/components/common/category-icon"
import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { addDays, format, isToday } from "date-fns"
import { ChevronLeft, ChevronRight, ListChecks, Pin, PinOff, Plus, Search, Star, StickyNote, X } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ListGroupLabel } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { CourseTag } from "@/features/learning/coursework"
import { noteColor, noteTitle } from "@/features/notes/note-colors"
import { CalendarLegend, JournalCalendar } from "@/features/journal/journal-calendar"
import { TaskRow } from "@/features/work/task-row"
import { GROUP_ORDER, compareTasks, groupOf, type TaskGroup } from "@/features/work/task-utils"
import { daysUntil, parseKey, shortAgo, timeAgo, toDateKey, todayKey } from "@/lib/dates"
import { logHref } from "@/lib/routes"
import type { Note, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Productivity → Planner. Left: one card with notes (a compact list) beside the
 * selected day's log. Right: the calendar with tasks under it. Both halves use
 * the shared grid's two-column, two-row units; with fewer columns they stack,
 * calendar and tasks first.
 */
export function PlannerPage() {
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const openForm = useUi((s) => s.openForm)
  const date = params.get("date") && VALID_DAY.test(params.get("date")!) ? params.get("date")! : todayKey()
  const day = parseKey(date)
  const [month, setMonth] = useState(day)
  const [shown, setShown] = useState(date)
  if (shown !== date) {
    setShown(date)
    setMonth(day)
  }
  const onDate = (d: string) => navigate(logHref(d), { replace: true })

  // ?note=<id> (search results, old Notes links) opens that note.
  const noteParam = params.get("note")
  useEffect(() => {
    if (!noteParam) return
    if (useWorkspace.getState().notes.some((n) => n.id === noteParam)) openForm({ kind: "note", id: noteParam })
    const next = new URLSearchParams(params)
    next.delete("note")
    setParams(next, { replace: true })
  }, [noteParam, params, setParams, openForm])

  // #day / #notes / #tasks: bring that part into view where the layout stacks.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
  }, [hash])


  return (
    <>
      <PageHeader
        title="Planner"
      />
      <WorkspaceGrid data-testid="planner">
        {/* Left: one card with the notes list beside the selected day's log (owner-approved arrangement). */}
        <GridItem span={2} rows={2}>
          <section aria-label="Notes and daily log" className="bw-panel grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[14rem_minmax(0,1fr)]">
            <NotesColumn />
            <DayColumn key={date} date={date} onDate={onDate} />
          </section>
        </GridItem>
        {/* Right: calendar with tasks under it. Beside the card at three columns (one column wide); first when the grid has two or fewer. */}
        <GridItem span={2} rows={2} className="@max-[52.99rem]:order-first @min-[53rem]:@max-[70.99rem]:col-span-1">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <section aria-label="Calendar" className="bw-panel flex shrink-0 flex-col overflow-hidden">
              <ColumnHeader category="calendar"><h2 className="min-w-0 text-[13px] font-semibold text-ink">Calendar</h2><span className="ml-auto" /></ColumnHeader>
              <div className="flex flex-col items-center gap-1.5 pt-1.5 pb-2.5">
                <JournalCalendar selected={date} onSelect={onDate} month={month} onMonthChange={setMonth} className="[--cell-size:--spacing(8)]" />
                <CalendarLegend />
              </div>
            </section>
            <TasksCard date={date} />
          </div>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}

/** A column header inside the shared card, the same height as a panel header. */
function ColumnHeader({ children, className, category, windowButtons = true }: { children: ReactNode; className?: string; category?: Category; windowButtons?: boolean }) {
  return (
    <header className={cn("bw-panel-heading flex shrink-0 items-center gap-1.5 border-b border-line-soft text-xs", className)}>
      {category && <CategoryIcon category={category} className="mr-0.5" />}
      {children}
      {windowButtons && <span className="bw-window-buttons" aria-hidden><span /><span /></span>}
    </header>
  )
}

function SearchBox({ value, onChange, label, onClose }: { value: string; onChange: (v: string) => void; label: string; onClose: () => void }) {
  return (
    <label className="mx-3 mt-2.5 flex h-8 shrink-0 items-center gap-2 rounded-[7px] border border-rim bg-well px-2.5">
      <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none md:text-[13px]"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="text-faint hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </label>
  )
}

/* ------------------------------------------------------------------ notes */

function NotesColumn() {
  const notes = useWorkspace((s) => s.notes)
  const openForm = useUi((s) => s.openForm)
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)

  const { pinned, others } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = notes.filter((n) => !needle || n.text.toLowerCase().includes(needle)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return { pinned: list.filter((n) => n.pinned), others: list.filter((n) => !n.pinned) }
  }, [notes, q])
  const closeSearch = () => {
    setQ("")
    setSearching(false)
  }

  return (
    <div id="notes" className="flex min-h-0 min-w-0 scroll-mt-28 flex-col border-b border-line md:border-r md:border-b-0">
      <ColumnHeader category="notes" windowButtons={false}>
        <h2 className="min-w-0 text-[13px] font-semibold text-ink">Notes</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">{notes.length}</span>
        <Button variant="quiet" size="icon-sm" aria-label="Search notes" aria-pressed={searching} onClick={() => (searching ? closeSearch() : setSearching(true))}>
          <Search />
        </Button>
        <Button variant="quiet" size="icon-sm" aria-label="New note" onClick={() => openForm({ kind: "note" })}>
          <Plus />
        </Button>
      </ColumnHeader>
      {searching && <SearchBox value={q} onChange={setQ} label="Search notes" onClose={closeSearch} />}
      <div className="max-h-96 min-h-0 flex-1 overflow-y-auto py-1.5">
        {pinned.length + others.length === 0 ? (
          <EmptyState icon={StickyNote} title={q ? "No notes match" : "No notes yet"} className="py-8" action={!q && <Button variant="outline" size="sm" onClick={() => openForm({ kind: "note" })}><Plus /> Add a note</Button>}>
            {q ? "Try a different search." : "Pinned notes also show on Home."}
          </EmptyState>
        ) : (
          <>
            {pinned.length > 0 && <NoteGroup label="Pinned" notes={pinned} />}
            {others.length > 0 && <NoteGroup label={pinned.length ? "Others" : "All notes"} notes={others} />}
          </>
        )}
      </div>
    </div>
  )
}

function NoteGroup({ label, notes }: { label: string; notes: Note[] }) {
  return (
    <section aria-label={label} className="mb-1.5 last:mb-0">
      <h3 className="bw-label px-3.5 pt-1.5 pb-1">
        {label} <span className="text-faint">· {notes.length}</span>
      </h3>
      <ul>
        {notes.map((n) => (
          <NoteLine key={n.id} note={n} />
        ))}
      </ul>
    </section>
  )
}

/** One note as a line: colour dot, first line, age. Click to open it. */
function NoteLine({ note }: { note: Note }) {
  const openForm = useUi((s) => s.openForm)
  const togglePin = useWorkspace((s) => s.togglePin)
  const course = useWorkspace((s) => (note.courseId ? s.courses.find((c) => c.id === note.courseId) : undefined))
  const title = noteTitle(note.text)
  const more = note.text.trim().includes("\n")
  return (
    <li className="group relative" data-testid="planner-note">
      <button
        type="button"
        onClick={() => openForm({ kind: "note", id: note.id })}
        className="flex h-8 w-full items-center gap-2.5 pr-9 pl-3.5 text-left hover:bg-raised"
        title={note.text.trim().slice(0, 300)}
      >
        <span className={cn("size-2 shrink-0 rounded-full", noteColor(note.color).swatch)} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
          {title}
          {more && <span className="text-faint"> …</span>}
        </span>
        {course && <CourseTag course={course} asLink={false} className="hidden h-4 px-1.5 text-[10px] xl:inline-flex" />}
        <span className="shrink-0 text-[10px] text-faint tabular-nums">{shortAgo(note.updatedAt)}</span>
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
          "absolute top-1 right-2 flex size-6 items-center justify-center rounded-[6px] text-faint hover:bg-ledge hover:text-ink",
          note.pinned ? "text-ink-2" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        {note.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
    </li>
  )
}

/* -------------------------------------------------------------- daily log */

/** The selected day: step through days, see what's due, and write its log. */
function DayColumn({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const day = parseKey(date)
  const tasks = useWorkspace((s) => s.tasks)
  const due = tasks.filter((t) => t.due === date && !t.done).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || compareTasks(a, b))
  const doneThatDay = tasks.filter((t) => t.done && t.completedAt && toDateKey(new Date(t.completedAt)) === date).length

  const entry = useWorkspace((s) => s.journal.find((j) => j.id === date))
  const saveJournal = useWorkspace((s) => s.saveJournal)
  const text = entry?.text ?? ""
  const dirty = false

  return (
    <div id="day" className="flex min-h-0 min-w-0 flex-1 scroll-mt-28 flex-col">
      <ColumnHeader category="journal">
        <Button variant="quiet" size="icon-sm" aria-label="Previous day" onClick={() => onDate(toDateKey(addDays(day, -1)))}>
          <ChevronLeft />
        </Button>
        <h2 className="min-w-0 truncate font-sans text-[13px] font-semibold text-ink">
          {format(day, "EEEE, MMM d")}
          {day.getFullYear() !== new Date().getFullYear() && <span className="ml-1 font-normal text-muted-foreground">{format(day, "yyyy")}</span>}
        </h2>
        <Button variant="quiet" size="icon-sm" aria-label="Next day" onClick={() => onDate(toDateKey(addDays(day, 1)))}>
          <ChevronRight />
        </Button>
        {isToday(day) ? (
          <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase">
            <span className="size-1.5 rounded-[1.5px] bg-red" aria-hidden /> Today
          </span>
        ) : (
          <Button variant="outline" size="xs" onClick={() => onDate(todayKey())}>
            Today
          </Button>
        )}
        <span className="ml-auto truncate pl-2 text-[10px] text-faint" aria-live="polite" data-testid="log-state">
          {dirty ? "Saving…" : entry ? `Saved ${timeAgo(entry.updatedAt)}` : ""}
        </span>
      </ColumnHeader>
      {(due.length > 0 || doneThatDay > 0) && (
        <div className="shrink-0 border-b border-line">
          {due.length > 0 && (
            <>
              <h3 className="bw-label px-3 pt-2 pb-0.5">Due this day · {due.length}</h3>
              <ul className="max-h-40 overflow-y-auto">
                {due.map((t) => (
                  <TaskRow key={t.id} task={t} dense hideDate />
                ))}
              </ul>
            </>
          )}
          {doneThatDay > 0 && (
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="text-green">✓</span> {doneThatDay} completed this day
            </p>
          )}
        </div>
      )}
      <label htmlFor="planner-log" className="bw-label px-3.5 pt-2.5 pb-1">Daily log</label>
      <textarea
        id="planner-log"
        value={text}
        onChange={(e) => saveJournal(date, e.target.value)}
        placeholder={isToday(day) ? "What happened today? What did you learn? What's next?" : `Write the log for ${format(day, "MMMM d")}…`}
        className="mx-3 mb-3 h-64 min-h-48 flex-1 resize-y rounded-[8px] border border-transparent bg-panel px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-rim md:text-[13px]"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ tasks */

type TaskTab = "today" | "next" | "all" | "done"

const inTab = (t: Task, tab: TaskTab) => {
  if (tab === "done") return t.done
  if (t.done) return false
  if (tab === "today") return !!t.due && daysUntil(t.due) <= 0
  if (tab === "next") return !!t.due && daysUntil(t.due) > 0
  return true
}

const TAB_GROUPS: Record<Exclude<TaskTab, "done">, TaskGroup[]> = {
  today: ["Overdue", "Today"],
  next: ["Tomorrow", "Next 7 days", "Later"],
  all: GROUP_ORDER,
}

/** Tasks under the calendar. Add opens the task form, due on the day selected in the calendar. */
function TasksCard({ date }: { date: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)
  const [tab, setTab] = useState<TaskTab>("today")
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)
  const [starred, setStarred] = useState(false)
  // Checked off here: stays visible (struck through) until the tab changes.
  const [lingering, setLingering] = useState<Set<string>>(new Set())

  const needle = q.trim().toLowerCase()
  const rows = useMemo(
    () =>
      tasks
        .filter((t) => (inTab(t, tab) || lingering.has(t.id)) && (!needle || t.title.toLowerCase().includes(needle) || !!t.details?.toLowerCase().includes(needle)) && (!starred || t.starred))
        .sort(compareTasks),
    [tasks, tab, lingering, needle, starred],
  )
  const count = (k: TaskTab) => tasks.filter((t) => inTab(t, k)).length
  const changeTab = (t: TaskTab) => {
    setTab(t)
    setLingering(new Set())
  }
  const closeSearch = () => {
    setQ("")
    setSearching(false)
  }
  const groups =
    tab === "done"
      ? [{ name: null as TaskGroup | null, items: rows }]
      : TAB_GROUPS[tab].map((g) => ({ name: g as TaskGroup | null, items: rows.filter((t) => groupOf(t) === g || (t.done && lingering.has(t.id) && g === TAB_GROUPS[tab][0])) })).filter((g) => g.items.length)
  const dueLabel = isToday(parseKey(date)) ? "today" : format(parseKey(date), "MMM d")
  const add = () => openForm({ kind: "task", defaults: { due: date } })

  return (
    <Panel
      id="tasks"
      category="tasks"
      title="Tasks"
      tool="tasks"
      command={tab}
      className="min-h-0 flex-1 scroll-mt-28"
      bodyClassName="flex min-h-0 flex-col"
      actions={
        <>
          <Button variant="quiet" size="icon-sm" aria-label="Search tasks" aria-pressed={searching} onClick={() => (searching ? closeSearch() : setSearching(true))}>
            <Search />
          </Button>
          <Button variant="quiet" size="icon-sm" aria-label="Starred only" aria-pressed={starred} onClick={() => setStarred(!starred)}>
            <Star className={cn(starred && "fill-current text-amber")} />
          </Button>
          <Button variant="ghost" size="sm" title={`New task, due ${dueLabel}`} onClick={add}>
            <Plus /> Task
          </Button>
        </>
      }
    >
      <div className="shrink-0 border-b border-line px-2.5 py-2">
        <SegmentedTabs
          label="Task views"
          idBase="planner-tasks"
          value={tab}
          onChange={changeTab}
          tabClassName="px-1 text-[11px]"
          tabs={[
            { value: "today", label: "Today", count: count("today") },
            { value: "next", label: "Next", count: count("next") },
            { value: "all", label: "All", count: count("all") },
            { value: "done", label: "Done" },
          ]}
        />
      </div>
      {searching && <SearchBox value={q} onChange={setQ} label="Search tasks" onClose={closeSearch} />}
      <div id="planner-tasks-panel" role="tabpanel" aria-labelledby={`planner-tasks-tab-${tab}`} className={cn("max-h-80 min-h-0 flex-1 overflow-y-auto", searching && "mt-2")}>
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
                  <TaskRow key={t.id} task={t} dense hideCourse onToggle={(x) => !x.done && setLingering((s) => new Set(s).add(x.id))} />
                ))}
              </ul>
            </section>
          ))
        ) : needle || starred ? (
          <EmptyState title="No tasks match" action={<Button variant="outline" size="sm" onClick={() => (closeSearch(), setStarred(false))}>Clear filters</Button>} />
        ) : (
          <EmptyState
            icon={ListChecks}
            title={{ today: "Nothing due today", next: "Nothing scheduled", all: "No open tasks", done: "Nothing completed yet" }[tab]}
            action={tab !== "done" && <Button variant="outline" size="sm" onClick={add}><Plus /> Add a task</Button>}
          />
        )}
      </div>
    </Panel>
  )
}
