import { format } from "date-fns"
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronRight as Go, NotebookPen, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { compareTasks } from "@/features/work/task-utils"
import { logHref } from "@/lib/routes"
import { parseKey, todayKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { LogTool } from "@/mac/dock/tools"
import { useDock } from "@/mac/dock/dock-store"
import { useWorkspace } from "@/stores/workspace"
import { addDaysToKey } from "@shared/date-keys"
import { validDateKey } from "@shared/planner"
import { checkInSummary, formWording, nextPeriod, periodStart, readCheckIn, reviewId, type Period, type Slot } from "@shared/journal-review"
import { isForToday } from "@shared/task-rules"
import { CheckInDialog } from "./check-in-dialog"
import { recentDayItems, recentDays } from "./recent-entries"
import { ReflectionsView } from "./reflections-view"

type View = Period | "reflections"
const VIEWS: { value: View; label: string }[] = [{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }, { value: "reflections", label: "Reflections" }]
const IS_MAC = typeof document !== "undefined" && document.documentElement.dataset.runtime === "mac-native"

function periodLabel(period: Period, anchor: string) {
  const d = parseKey(anchor)
  if (period === "daily") return format(d, "EEEE, MMMM d")
  if (period === "weekly") return `${format(d, "MMM d")} – ${format(parseKey(addDaysToKey(anchor, 6)!), "MMM d, yyyy")}`
  if (period === "monthly") return format(d, "MMMM yyyy")
  return format(d, "yyyy")
}

/** One check-in as a card: grey until saved, then green with its one-line summary. */
function CheckInCard({ title, blurb, icon: Icon, summary, saved, now, onClick }: { title: string; blurb: string; icon: typeof Sun; summary?: string; saved: boolean; now?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${title}, ${saved ? "done. Edit" : "not done yet. Add"}`}
      className={cn("flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-raised", saved ? "border-[color-mix(in_srgb,var(--bw-green)_45%,var(--bw-line))] bg-[color-mix(in_srgb,var(--bw-green)_10%,transparent)]" : "border-line")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-raised", saved ? "text-green" : "text-[var(--bw-blue,#64b5f6)]")}><Icon className="size-4" aria-hidden /></span>
      <span className="min-w-0 flex-1"><span className={cn("block text-[13px] font-semibold", saved ? "text-green" : "text-ink")}>{title}</span><span className="block truncate text-xs text-muted-foreground">{saved ? summary || "Saved" : blurb}</span></span>
      {now && !saved && <span className="rounded-full bg-[#64b5f622] px-2 py-0.5 text-[10px] font-semibold text-[var(--bw-blue,#64b5f6)]">Now</span>}
      {saved ? <CheckCircle2 className="size-5 text-green" aria-hidden /> : <Go className="size-4 text-faint" aria-hidden />}
    </button>
  )
}

/** The work on this day, so the Journal and the Planner say the same thing: what was due, and what got done. */
function DayWork({ day }: { day: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const toggle = useWorkspace((s) => s.toggleTask)
  const rows = tasks.filter((t) => t.kind !== "event" && (t.due === day || (t.done && t.completedAt && t.completedAt.slice(0, 10) === day))).sort((a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title))
  if (!rows.length) return <p className="text-xs text-muted-foreground">Nothing was due or finished on {periodLabel("daily", day)}.</p>
  return (
    <ul className="grid gap-0.5" aria-label="Work on this day">{rows.slice(0, 8).map((t) => (
      <li key={t.id} className="flex min-h-8 items-center gap-2 text-[13px]"><Checkbox checked={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onCheckedChange={() => toggle(t.id)} /><span className={cn("min-w-0 flex-1 truncate text-ink-2", t.done && "text-faint line-through")}>{t.title}</span><span className="shrink-0 text-[11px] text-muted-foreground">{t.due === day ? "due" : "done"}</span></li>
    ))}{rows.length > 8 && <li className="text-[11px] text-faint">…and {rows.length - 8} more in the Planner</li>}</ul>
  )
}

/** The latest days with something saved. Pick a day to see what is in it; Open day goes there. */
function RecentEntries({ today, onOpenDay }: { today: string; onOpenDay: (day: string) => void }) {
  const journal = useWorkspace((s) => s.journal)
  const [open, setOpen] = useState<string | null>(null)
  const days = recentDays(journal)
  const title = (day: string) => `${format(parseKey(day), "EEE, MMM d")}${day === today ? " · today" : ""}`
  return (
    <Panel category="journal" title="Recent entries" tool="journal" command="recent" count={days.length || undefined} bodyClassName={days.length ? undefined : "px-3.5 py-3"}>
      {days.length ? <ul>{days.map(({ day, preview }) => {
        const on = open === day
        return (
          <li key={day} className={cn("border-b border-line-soft border-l-[3px] last:border-b-0", on ? "border-l-[var(--bw-category)] bg-selected" : "border-l-transparent hover:bg-raised")}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : day)} className="grid w-full gap-0.5 px-3 py-2 text-left">
              <span className="text-[12px] font-semibold text-ink">{title(day)}</span>
              <span className="truncate text-xs text-muted-foreground">{preview}</span>
            </button>
            {on && <div className="grid gap-2 px-3 pb-2.5">
              {recentDayItems(journal, day).map((item) => <div key={item.id} className="grid gap-0.5"><span className="bw-label text-[10px]">{item.label}</span><p className="line-clamp-4 text-xs leading-snug whitespace-pre-line text-ink-2">{item.text.trim() ? item.text.trim() : item.summary}</p></div>)}
              <Button size="xs" className="w-fit rounded-full" onClick={() => onOpenDay(day)}>Open day</Button>
            </div>}
          </li>
        )
      })}</ul> : <p className="text-sm text-muted-foreground">No entries yet. Your dated entries appear here.</p>}
    </Panel>
  )
}

/** Journal: three quick check-ins and the daily log, plus weekly, monthly and yearly reviews. The same records the Android app uses. */
export function JournalPage() {
  const [params, setParams] = useSearchParams()
  const asked = params.get("view")
  const view: View = VIEWS.some((v) => v.value === asked) ? (asked as View) : "daily"
  const day = useDock((s) => s.date)
  const setDay = useDock((s) => s.setDate)
  // Linked from the Planner: /journal?date=2026-11-09 opens that day.
  const asDate = params.get("date")
  useEffect(() => { if (asDate && validDateKey(asDate)) { useDock.getState().setDate(asDate); setParams((p) => { const n = new URLSearchParams(p); n.delete("date"); return n }, { replace: true }) } }, [asDate, setParams])
  const journal = useWorkspace((s) => s.journal)
  const tasks = useWorkspace((s) => s.tasks)
  const [dialog, setDialog] = useState<{ slot?: Slot } | null>(null)
  const today = todayKey()
  const period: Period = view === "reflections" ? "daily" : view
  const anchor = periodStart(period, day)
  const end = nextPeriod(period, anchor, 1)
  const entry = journal.find((j) => j.id === anchor)
  const savedFor = (slot?: Slot) => entry?.entries?.find((i) => i.id === reviewId(period, anchor, slot))
  const todayTitles = tasks.filter((t) => t.kind !== "event" && !t.done && isForToday(t, today)).sort(compareTasks).slice(0, 6).map((t) => t.title.trim().replace(/\s+/g, " ")).filter(Boolean)
  const written = journal.filter((j) => j.id >= anchor && j.id < end && (j.text.trim() || j.sections?.length || j.entries?.some((i) => !i.courseId && !i.taskId))).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 20)
  const step = (dir: 1 | -1) => setDay(period === "daily" ? addDaysToKey(day, dir)! : nextPeriod(period, anchor, dir))
  const choose = (next: View) => setParams((p) => { const n = new URLSearchParams(p); n.set("view", next); return n }, { replace: true })
  const firstLine = (j: (typeof journal)[number]) => (j.text.trim() || j.entries?.find((i) => !i.courseId && !i.taskId)?.text || "").split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean) ?? "Saved"

  return (
    <>
      <PageHeader title="Journal" subtitle={view === "reflections" ? undefined : periodLabel(period, anchor)}
        actions={view === "reflections" ? undefined : <><Button variant="outline" size="sm" disabled={anchor === periodStart(period, today)} onClick={() => setDay(today)}>Today</Button><Button variant="quiet" size="icon-sm" aria-label={`Previous ${period === "daily" ? "day" : period.slice(0, -2)}`} onClick={() => step(-1)}><ChevronLeft /></Button><Button variant="quiet" size="icon-sm" aria-label={`Next ${period === "daily" ? "day" : period.slice(0, -2)}`} onClick={() => step(1)}><ChevronRight /></Button></>} />
      <div className="mb-3"><SegmentedTabs<View> label="Journal view" value={view} onChange={choose} className="max-w-full overflow-x-auto" tabs={VIEWS} /></div>
      {view === "reflections" ? <ReflectionsView /> : (
        <WorkspaceGrid>
          {view !== "daily" && <GridItem span={2}>
            <Panel category="journal" title={formWording(period).title} tool="journal" command="check-in" bodyClassName="grid gap-2 p-3">
              <CheckInCard title={formWording(period).title} blurb={`A short look back at the ${period.slice(0, -2)}`} icon={NotebookPen} saved={!!savedFor()} summary={savedFor() ? checkInSummary(readCheckIn(savedFor()!.text)) : undefined} onClick={() => setDialog({})} />
            </Panel>
          </GridItem>}
          {view === "daily" ? (
            <>
            <GridItem span={2}>
              <Panel category="journal" title="Log" tool="journal" command="log" bodyClassName="p-0">
                {IS_MAC ? <LogTool hideNav /> : <p className="px-3.5 py-3 text-sm text-muted-foreground">The daily log opens in the Planner: <Link className="underline" to={logHref(day)}>open this day</Link>.</p>}
              </Panel>
            </GridItem>
            <GridItem>
              <div className="grid gap-3">
                <Panel category="journal" title="This day" tool="journal" command="day" bodyClassName="grid gap-2 p-3">
                  <DayWork day={day} />
                  <Button variant="outline" size="sm" asChild><Link to={logHref(day)}>See this day in the Planner</Link></Button>
                </Panel>
                <RecentEntries today={today} onOpenDay={setDay} />
              </div>
            </GridItem>
            </>
          ) : (
            <GridItem span={2}>
              <Panel category="journal" title={`Written this ${period.slice(0, -2)}`} tool="journal" command="written" meta={written.length || undefined} bodyClassName={written.length ? undefined : "px-3.5 py-3"}>
                {written.length ? <ul>{written.map((j) => <li key={j.id}><button type="button" onClick={() => { setDay(j.id); choose("daily") }} className="flex min-h-11 w-full items-center gap-3 border-b border-line-soft px-3.5 py-1.5 text-left last:border-b-0 hover:bg-raised"><span className="w-14 shrink-0 text-[12px] tabular-nums text-ink-2">{format(parseKey(j.id), "MMM d")}</span><span className="min-w-0 flex-1 truncate text-[13px] text-ink">{firstLine(j)}</span></button></li>)}</ul>
                  : <p className="text-sm text-muted-foreground">Nothing written yet this {period.slice(0, -2)}. Days you log appear here.</p>}
              </Panel>
            </GridItem>
          )}
        </WorkspaceGrid>
      )}
      {dialog && <CheckInDialog key={`${period}${anchor}${dialog.slot ?? ""}`} period={period} anchor={anchor} slot={dialog.slot} todayTitles={todayTitles} onClose={() => setDialog(null)} />}
    </>
  )
}
