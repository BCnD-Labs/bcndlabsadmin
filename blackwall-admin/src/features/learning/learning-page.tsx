import { format } from "date-fns"
import { CalendarDays, CalendarRange, ChevronDown, Clock3, Library, ListTodo, Plus } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/common/page-header"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { parseKey, todayKey } from "@/lib/dates"
import type { Course } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { MacToolNavigation } from "@/mac/tool-navigation"
import { KindIcon } from "./coursework"
import { TodayView } from "./today-view"
import { WeekView } from "./week-view"
import { TermView } from "./term-view"
import { LibraryView } from "./library-view"
import { UpcomingView } from "./upcoming-view"
import { KINDS } from "./learning-utils"

/** "Add learning": one entry per kind, each with what it tracks. */
function AddLearning({ label = "Add learning", variant }: { label?: string; variant?: "outline" }) {
  const openForm = useUi((s) => s.openForm)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant}>
          <Plus /> {label} <ChevronDown className="opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="bw-label">Add learning</DropdownMenuLabel>
        {KINDS.map((k) => (
          <DropdownMenuItem key={k.value} onSelect={() => openForm({ kind: "course", defaults: { kind: k.value } })} className="items-start gap-2.5 py-2">
            <KindIcon kind={k.value} />
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] text-ink">{k.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{k.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const dateRange = (c: Pick<Course, "startDate" | "endDate">) =>
  [c.startDate, c.endDate].filter(Boolean).map((d) => format(parseKey(d!), "MMM d, yyyy")).join(" – ")

/** A progress ring (certifications): percent in the middle. */
export function ProgressRing({ pct, label, size = 56 }: { pct: number; label: string; size?: number }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pct}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bw-off, #3a414c)" strokeWidth={6} className="stroke-off" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bw-category)" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="fill-ink text-[13px] font-semibold tabular-nums">{pct}%</text>
    </svg>
  )
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-off" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[var(--bw-category)]" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Today and Week plan the days; Upcoming lists every dated item; Library is everything you're learning; Term shows the semester. */
type LearningView = "today" | "week" | "upcoming" | "library" | "term"

export function LearningPage() {
  const courses = useWorkspace((s) => s.courses)
  const [params, setParams] = useSearchParams()
  const asked = params.get("view")
  // "courses" was this tab's old name; keep old links working.
  const view: LearningView = asked === "courses" ? "library" : asked === "week" || asked === "upcoming" || asked === "library" || asked === "term" || asked === "today" ? asked : courses.length ? "today" : "library"
  const today = todayKey()
  const mac = document.documentElement.dataset.runtime === "mac-native"
  const choose = (next: LearningView) => setParams((p) => { const n = new URLSearchParams(p); n.set("view", next); return n }, { replace: true })
  const content = view === "today" ? <TodayView today={today} /> : view === "week" ? <WeekView today={today} /> : view === "term" ? <TermView today={today} /> : view === "upcoming" ? <UpcomingView /> : <LibraryView />
  return (
    <>
      <PageHeader title="Learning" actions={<AddLearning />} />
      {mac ? <MacToolNavigation label="Learning" value={view} onChange={choose} items={[
        { value: "today", label: "Today", icon: <CalendarDays /> },
        { value: "week", label: "Week", icon: <CalendarRange /> },
        { value: "upcoming", label: "Upcoming", icon: <Clock3 /> },
        { value: "library", label: "Library", icon: <Library /> },
        { value: "term", label: "Term", icon: <ListTodo /> },
      ]}>{content}</MacToolNavigation> : <>{courses.length > 0 && (
        <div className="mb-3">
          <SegmentedTabs<LearningView> label="Learning view" value={view} onChange={choose} className="max-w-full overflow-x-auto" tabs={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }, { value: "upcoming", label: "Upcoming" }, { value: "library", label: "Library" }, { value: "term", label: "Term" }]} />
        </div>
      )}{content}</>}
    </>
  )
}
