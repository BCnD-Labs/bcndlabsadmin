import { format, startOfWeek } from "date-fns"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { Map as MapIcon } from "lucide-react"
import { parseKey, toDateKey, weekStart } from "@/lib/dates"
import { courseHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { degreeMap, termTimeline } from "@shared/learning"
import { COURSE_STATUS_LABEL, courseColor, courseLabel, courseStatus } from "./learning-utils"

const WEEKS = 14

/** Weekly workload across your courses, and every semester at a glance. */
export function TermView({ today }: { today: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const start = toDateKey(startOfWeek(parseKey(today), { weekStartsOn: weekStart() }))
  const line = termTimeline({ tasks, courses }, start, WEEKS)
  const map = degreeMap(courses)
  const max = Math.max(1, ...line.weeks.map((w) => w.count))
  return (
    <div className="grid gap-3">
      <Panel category="calendar" title="Workload by week" tool="learning" command="timeline" meta={`${WEEKS} weeks`} bodyClassName="overflow-x-auto">
        {line.rows.length ? (
          <table className="w-full min-w-[40rem] border-collapse text-[11px]">
            <thead><tr><th className="w-40 px-3 py-1.5 text-left font-normal text-muted-foreground">Open work due</th>{line.weeks.map((w) => <th key={w.start} className="px-1 py-1.5 text-center font-normal text-muted-foreground" title={`Week of ${format(parseKey(w.start), "MMM d")}`}>{format(parseKey(w.start), "M/d")}</th>)}</tr></thead>
            <tbody>
              {line.rows.map((r) => (
                <tr key={r.course.id} className="border-t border-line-soft">
                  <th className="px-3 py-1.5 text-left font-normal"><Link to={courseHref(r.course.id)} className="flex items-center gap-1.5 text-ink hover:underline"><span className={cn("size-2 rounded-[2px]", courseColor(r.course.color).dot)} aria-hidden /><span className="truncate">{courseLabel(r.course)}</span></Link></th>
                  {r.cells.map((c, i) => <td key={i} className="px-1 py-1 text-center">{c.count ? <span title={c.exam ? "Includes an exam" : undefined} className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] px-1 font-semibold tabular-nums", c.exam ? "bg-red/25 text-red" : "bg-[#64b5f61f] text-ink")}>{c.count}</span> : <span className="text-faint">·</span>}</td>)}
                </tr>
              ))}
              <tr className="border-t border-line bg-well">
                <th className="px-3 py-1.5 text-left font-semibold text-ink-2">All courses</th>
                {line.weeks.map((w) => <td key={w.start} className="px-1 py-1.5 text-center"><div className="mx-auto flex h-8 w-5 items-end" title={`${w.count} due`}><span className={cn("block w-full rounded-t-[3px]", w.exam ? "bg-red" : "bg-[var(--bw-blue,#64b5f6)]")} style={{ height: `${Math.max(w.count ? 12 : 3, (w.count / max) * 100)}%`, opacity: w.count ? 1 : .3 }} /></div></td>)}
              </tr>
            </tbody>
          </table>
        ) : <EmptyState icon={MapIcon} title="No current courses">Courses with open work in the next {WEEKS} weeks show up here, so a crunch week isn't a surprise.</EmptyState>}
      </Panel>
      <Panel category="learning" title="Degree map" tool="learning" command="terms" meta={map.length ? `${map.reduce((n, g) => n + g.credits, 0)} credits` : undefined} bodyClassName="grid gap-2.5 p-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {map.length ? map.map((g) => (
          <section key={g.term} aria-label={g.term} className="rounded-lg border border-line-soft bg-well">
            <header className="flex items-baseline gap-2 border-b border-line-soft px-2.5 py-1.5"><strong className="text-[13px] text-ink">{g.term}</strong><span className="ml-auto text-[11px] text-muted-foreground">{g.courses.length} course{g.courses.length === 1 ? "" : "s"}{g.credits ? ` · ${g.credits} cr` : ""}</span></header>
            <ul>{g.courses.map((c) => <li key={c.id}><Link to={courseHref(c.id)} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-raised"><span className={cn("size-2 shrink-0 rounded-[2px]", courseColor(c.color).dot)} aria-hidden /><span className="min-w-0 flex-1 truncate text-ink">{c.title}</span><span className="text-[10px] text-muted-foreground">{COURSE_STATUS_LABEL[courseStatus(c, today)]}</span></Link></li>)}</ul>
          </section>
        )) : <EmptyState icon={MapIcon} title="No semesters yet" className="sm:col-span-2 xl:col-span-3">Give each course a term (like Fall 2026) and credits, and your semesters line up here.</EmptyState>}
      </Panel>
    </div>
  )
}
