import { format } from "date-fns"
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronRight as Go, Moon, NotebookPen, Plus, Sun, SunMedium } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { OptionSelect } from "@/components/forms/fields"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { compareTasks } from "@/features/work/task-utils"
import { newId } from "@/lib/ids"
import { logHref } from "@/lib/routes"
import { parseKey, todayKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { LogTool } from "@/mac/dock/tools"
import { useDock } from "@/mac/dock/dock-store"
import { useWorkspace } from "@/stores/workspace"
import { addDaysToKey } from "@shared/date-keys"
import { validDateKey } from "@shared/planner"
import { SLOTS, checkInSummary, formWording, nextPeriod, periodStart, readCheckIn, readSlotCheckIn, reviewId, slotForHour, slotSummary, type Period, type Slot } from "@shared/journal-review"
import { isForToday } from "@shared/task-rules"
import { CheckInDialog } from "./check-in-dialog"

type View = Period | "reflections"
const VIEWS: { value: View; label: string }[] = [{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }, { value: "reflections", label: "Reflections" }]
const SLOT_ICON = { morning: Sun, afternoon: SunMedium, evening: Moon } as const
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

function Reflections() {
  const journal = useWorkspace((s) => s.journal)
  const courses = useWorkspace((s) => s.courses)
  const tasks = useWorkspace((s) => s.tasks)
  const saveItem = useWorkspace((s) => s.saveJournalItem)
  const [courseId, setCourseId] = useState("")
  const [text, setText] = useState("")
  const rows = useMemo(() => journal.flatMap((j) => (j.entries ?? []).filter((i) => i.courseId).map((i) => ({ day: j.id, item: i }))).sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt)), [journal])
  const add = () => {
    if (!text.trim() || !courseId) return
    const now = new Date().toISOString()
    const id = newId("log")
    saveItem(todayKey(), { id, text: text.trim(), courseId, createdAt: now, updatedAt: now })
    if (useWorkspace.getState().journal.some((j) => j.entries?.some((i) => i.id === id))) { setText(""); toast.success("Reflection saved") } else toast.error("Couldn't save. Your text is still here.")
  }
  return (
    <WorkspaceGrid>
      <GridItem span={2}>
        <Panel category="journal" title="Learning reflections" tool="journal" command="reflections" meta={rows.length || undefined} bodyClassName="grid gap-2.5 px-3.5 py-3">
          <div className="grid gap-2 sm:grid-cols-[14rem_1fr_auto]">
            <OptionSelect value={courseId} onChange={setCourseId} label="Course" options={[{ value: "", label: "Choose a course…" }, ...courses.map((c) => ({ value: c.id, label: c.code || c.title }))]} />
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you learn, or what is still unclear?" aria-label="Reflection" />
            <Button disabled={!text.trim() || !courseId} onClick={add}><Plus /> Add</Button>
          </div>
          {rows.length ? <ul>{rows.map(({ day, item }) => {
            const course = courses.find((c) => c.id === item.courseId)
            const task = tasks.find((t) => t.id === item.taskId)
            return <li key={item.id} className="border-t border-line-soft py-2"><p className="text-[11px] text-muted-foreground">{format(parseKey(day), "MMM d")} · {course ? <Link className="hover:underline" to={`/productivity/learning/${course.id}`}>{course.code || course.title}</Link> : "Course removed"}{task ? ` · ${task.title}` : ""}</p><p className="mt-0.5 whitespace-pre-wrap text-[13px] text-ink">{item.text}</p></li>
          })}</ul> : <EmptyState icon={NotebookPen} title="No reflections yet">Pick a course and write a line or two. They also show on that course's page.</EmptyState>}
        </Panel>
      </GridItem>
    </WorkspaceGrid>
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
  const nowSlot = day === today ? slotForHour(new Date().getHours()) : undefined
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
      {view === "reflections" ? <Reflections /> : (
        <WorkspaceGrid>
          <GridItem span={view === "daily" ? 1 : 2}>
            <Panel category="journal" title={view === "daily" ? "Check-ins" : formWording(period).title} tool="journal" command="check-in" meta={view === "daily" ? `${SLOTS.filter((x) => savedFor(x.key)).length} of 3 done` : undefined} bodyClassName="grid gap-2 p-3">
              {view === "daily" ? <>
                <p className="text-xs text-muted-foreground">Three quick check-ins a day, mostly taps. A card turns green once it is saved.</p>
                {SLOTS.map((x) => { const s = savedFor(x.key); return <CheckInCard key={x.key} title={x.label} blurb={x.blurb} icon={SLOT_ICON[x.key]} saved={!!s} summary={s ? slotSummary(x.key, readSlotCheckIn(x.key, s.text)) : undefined} now={nowSlot === x.key} onClick={() => setDialog({ slot: x.key })} /> })}
                {savedFor() && <CheckInCard title="Earlier check-in" blurb="Saved before the three daily check-ins" icon={NotebookPen} saved summary={checkInSummary(readCheckIn(savedFor()!.text))} onClick={() => setDialog({})} />}
              </> : <CheckInCard title={formWording(period).title} blurb={`A short look back at the ${period.slice(0, -2)}`} icon={NotebookPen} saved={!!savedFor()} summary={savedFor() ? checkInSummary(readCheckIn(savedFor()!.text)) : undefined} onClick={() => setDialog({})} />}
            </Panel>
          </GridItem>
          {view === "daily" ? (
            <>
            <GridItem>
              <Panel category="journal" title="This day" tool="journal" command="day" bodyClassName="grid gap-2 p-3">
                <p className="text-xs text-muted-foreground">{periodLabel("daily", day)}. Use the arrows above to change day. Days you have written in show a dot on the Planner calendar.</p>
                <Button variant="outline" size="sm" asChild><Link to={logHref(day)}>See this day in the Planner</Link></Button>
              </Panel>
            </GridItem>
            <GridItem span="full">
              <Panel category="journal" title="Daily log" tool="journal" command="log" bodyClassName="p-0">
                {IS_MAC ? <LogTool /> : <p className="px-3.5 py-3 text-sm text-muted-foreground">The daily log opens in the Planner: <Link className="underline" to={logHref(day)}>open this day</Link>.</p>}
              </Panel>
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
