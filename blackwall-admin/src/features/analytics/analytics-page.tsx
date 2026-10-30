import { Activity, BarChart3, FileText, Link2, ListChecks, PenLine } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useWorkspace } from "@/stores/workspace"
import { GROUP_ORDER, groupOf } from "@/features/work/task-utils"
import { CompletedChart, JournalHeatmap, Stat } from "./personal-charts"
import { usePersonalStats } from "./personal-stats"
import { PageHeader, Panel } from "@/components/common/panel"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { SourceBadge } from "@/components/common/source-badge"
import { useAnalytics } from "@/services/data"
import type { TrafficRange } from "@/services/types"
import { RangeToggle, TrafficChart, TrafficSummary } from "./traffic-chart"

const fmt = new Intl.NumberFormat("en")

function WebsiteAnalytics({ tabs }: { tabs: ReactNode }) {
  const [range, setRange] = useState<TrafficRange>(30)
  const feed = useAnalytics(range)
  const badge = <SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />

  if (!hasData(feed)) {
    return (
      <>
        <PageHeader title="Analytics" badge={badge} actions={<>{tabs}<RangeToggle value={range} onChange={setRange} /></>} />
        <div className="brutal rounded-xl bg-card">
          <FeedFallback feed={feed} provider="analytics" what="visitors, pageviews, top pages and referrers" />
        </div>
      </>
    )
  }

  const { traffic, pages, referrers } = feed.data
  const maxRef = Math.max(1, ...referrers.map((r) => r.visitors))
  const showVisitors = pages.some((p) => p.visitors > 0)

  return (
    <>
      <PageHeader title="Analytics" badge={badge} actions={<>{tabs}<RangeToggle value={range} onChange={setRange} /></>} />
      <div className="grid gap-3 lg:grid-cols-12">
        <Panel title="Visitors & pageviews per day" icon={<Activity />} accent="blue" className="lg:col-span-12" bodyClassName="flex flex-col gap-2 p-3">
          <TrafficSummary data={traffic} />
          <TrafficChart data={traffic} range={range} className="h-80" />
        </Panel>
        <Panel title="Top pages" icon={<FileText />} accent="teal" className="lg:col-span-7">
          {pages.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="eyebrow border-b text-left">
                    <th className="px-3 py-2 font-normal">Path</th>
                    <th className="px-3 py-2 text-right font-normal">Pageviews</th>
                    {showVisitors && <th className="px-3 py-2 text-right font-normal">Visitors</th>}
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.path} className="border-b border-border/60 last:border-0">
                      <td className="max-w-0 truncate px-3 py-1.5 font-mono text-xs">{p.path}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt.format(p.pageviews)}</td>
                      {showVisitors && <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt.format(p.visitors)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-3 text-sm text-muted-foreground">No page data for this range.</p>
          )}
        </Panel>
        <Panel title="Referrers (visitors)" icon={<Link2 />} accent="amber" className="lg:col-span-5" bodyClassName="p-3">
          {referrers.length ? (
            <ul className="space-y-2">
              {referrers.map((r) => (
                <li key={r.source} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2 text-sm">
                  <span className="truncate text-muted-foreground" title={r.source}>{r.source}</span>
                  <span className="h-2.5 rounded-r-sm bg-recessed">
                    <span className="block h-full rounded-r-sm bg-chart-1" style={{ width: `${(r.visitors / maxRef) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums">{fmt.format(r.visitors)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No referrer data for this range.</p>
          )}
        </Panel>
      </div>
    </>
  )
}

function PersonalAnalytics({ tabs }: { tabs: ReactNode }) {
  const s = usePersonalStats(30)
  const tasks = useWorkspace((st) => st.tasks)
  const open = tasks.filter((t) => !t.done)
  const byGroup = GROUP_ORDER.map((g) => ({ g, n: open.filter((t) => groupOf(t) === g).length }))
  const maxGroup = Math.max(1, ...byGroup.map((b) => b.n))
  const total30 = s.completed.reduce((a, d) => a + d.count, 0)

  return (
    <>
      <PageHeader title="Analytics" description="Worked out from your own tasks and daily logs." actions={tabs} />
      <dl className="brutal mb-4 grid grid-cols-2 gap-3 rounded-xl bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Open tasks" value={s.open} />
        <Stat label="Overdue" value={s.overdue} tone={s.overdue ? "red" : undefined} />
        <Stat label="Done this week" value={s.thisWeek} sub={`last week ${s.lastWeek}`} />
        <Stat label="Task streak" value={s.doneStreak} sub="days" />
        <Stat label="Log streak" value={s.logStreak} sub="days" />
        <Stat label="Logs, last 30 days" value={s.logsLast30} sub="/ 30" />
      </dl>
      <div className="grid gap-3 lg:grid-cols-12">
        <Panel title="Tasks completed per day" icon={<BarChart3 />} accent="teal" className="lg:col-span-8" bodyClassName="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Last 30 days · {total30} total</p>
          <CompletedChart data={s.completed} className="h-64" />
        </Panel>
        <Panel title="Open tasks by due date" icon={<ListChecks />} accent="amber" className="lg:col-span-4" bodyClassName="p-3">
          {open.length ? (
            <ul className="space-y-2">
              {byGroup.map(({ g, n }) => (
                <li key={g} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-sm">
                  <span className={g === "Overdue" && n ? "text-red-text" : "text-muted-foreground"}>{g}</span>
                  <span className="h-2.5 rounded-r-sm bg-recessed/40">
                    <span className={`block h-full rounded-r-sm ${g === "Overdue" ? "bg-red" : "bg-chart-1"}`} style={{ width: `${(n / maxGroup) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No open tasks.</p>
          )}
        </Panel>
        <Panel title="Daily log" icon={<PenLine />} accent="magenta" className="lg:col-span-12" bodyClassName="p-3">
          <p className="mb-2 text-xs text-muted-foreground">Last 26 weeks, Monday to Sunday top to bottom. Click a day to open its log.</p>
          <JournalHeatmap logWords={s.logWords} weeks={26} cell="size-4" />
        </Panel>
      </div>
    </>
  )
}

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get("view") === "website" ? "website" : "you"
  const tabs = (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={view}
      onValueChange={(v) => v && setParams(v === "you" ? {} : { view: v }, { replace: true })}
      aria-label="Analytics view"
    >
      <ToggleGroupItem value="you" className="px-2.5 text-xs">You</ToggleGroupItem>
      <ToggleGroupItem value="website" className="px-2.5 text-xs">Website</ToggleGroupItem>
    </ToggleGroup>
  )
  return view === "website" ? <WebsiteAnalytics tabs={tabs} /> : <PersonalAnalytics tabs={tabs} />
}
