import { useState } from "react"
import { useWorkspace } from "@/stores/workspace"
import { GROUP_ORDER, groupOf } from "@/features/work/task-utils"
import { CompletedChart, JournalHeatmap } from "./personal-charts"
import { usePersonalStats } from "./personal-stats"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { cn } from "@/lib/utils"
import { useAnalytics } from "@/services/data"
import type { TrafficRange } from "@/services/types"
import { DailyBars, RangeToggle } from "./traffic-chart"
import { StatStrip } from "@/components/common/stat-strip"
import { format } from "date-fns"
import { parseKey } from "@/lib/dates"

const fmt = new Intl.NumberFormat("en")

/** A labelled horizontal bar for small breakdowns (referrers, open tasks by due date). */
function BarRow({ label, value, max, tone, mono }: { label: string; value: number; max: number; tone?: "warn"; mono?: boolean }) {
  return (
    <li className={cn("grid items-center gap-3 text-xs", mono ? "grid-cols-[minmax(0,1fr)_5rem_2rem]" : "grid-cols-[minmax(0,7rem)_1fr_3rem]")}>
      <span className={cn("truncate", mono && "font-mono text-[11px] text-ink-2", tone === "warn" && value ? "text-amber" : !mono && "text-muted-foreground")} title={label}>{label}</span>
      <span className="h-2 rounded-[2px] bg-off">
        <span className={cn("block h-full rounded-[2px]", tone === "warn" ? "bg-amber" : "bg-chart-1")} style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className="text-right font-mono text-[11px] text-ink-2 tabular-nums">{fmt.format(value)}</span>
    </li>
  )
}

function WebsiteAnalytics() {
  const [range, setRange] = useState<TrafficRange>(30)
  const feed = useAnalytics(range)
  const badge = <SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />

  if (!hasData(feed)) {
    return (
      <Panel tool="site" command="traffic" badge={badge} className="max-w-3xl">
        <FeedFallback feed={feed} provider="analytics" what="visitors, pageviews, top pages and referrers" />
      </Panel>
    )
  }

  const { traffic, pages, referrers } = feed.data
  const visitors = traffic.reduce((a, p) => a + p.visitors, 0)
  const pageviews = traffic.reduce((a, p) => a + p.pageviews, 0)
  const busiest = traffic.reduce((best, p) => (p.visitors > best.visitors ? p : best), traffic[0] ?? { date: "", visitors: 0, pageviews: 0 })
  const activeDays = traffic.filter((p) => p.visitors > 0).length
  const maxPage = Math.max(1, ...pages.map((p) => p.pageviews))
  const maxRef = Math.max(1, ...referrers.map((r) => r.visitors))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        <span className="text-[11px] text-muted-foreground">Last {range} days, ending yesterday</span>
        <RangeToggle value={range} onChange={setRange} className="ml-auto" />
      </div>
      <StatStrip
        items={[
          { label: "Visitors", value: fmt.format(visitors), sub: `${(visitors / range).toFixed(1)} a day on average` },
          { label: "Pageviews", value: fmt.format(pageviews), sub: visitors ? `${(pageviews / visitors).toFixed(1)} pages per visit` : undefined },
          { label: "Days with visits", value: `${activeDays} / ${range}` },
          { label: "Busiest day", value: busiest.visitors ? format(parseKey(busiest.date), "MMM d") : "—", sub: busiest.visitors ? `${busiest.visitors} ${busiest.visitors === 1 ? "visitor" : "visitors"}` : undefined },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel tool="site" command={`visitors --${range}d`} bodyClassName="flex px-2 pt-2 pb-1.5">
          <DailyBars data={traffic} range={range} className="h-44 w-full lg:h-full lg:min-h-44" />
        </Panel>
        <div className="flex min-w-0 flex-col gap-3">
          <Panel tool="site" command="top-pages" meta="views" bodyClassName="px-3.5 py-2.5">
            {pages.length ? (
              <ul className="space-y-2">
                {pages.slice(0, 6).map((p) => <BarRow key={p.path} label={p.path} value={p.pageviews} max={maxPage} mono />)}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">No page views in this range.</p>
            )}
          </Panel>
          <Panel tool="site" command="referrers" meta="visitors" bodyClassName="px-3.5 py-2.5">
            {referrers.length ? (
              <ul className="space-y-2">
                {referrers.slice(0, 5).map((r) => <BarRow key={r.source} label={r.source} value={r.visitors} max={maxRef} />)}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">No referrers in this range.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function PersonalAnalytics() {
  const s = usePersonalStats(30)
  const tasks = useWorkspace((st) => st.tasks)
  const open = tasks.filter((t) => !t.done)
  const byGroup = GROUP_ORDER.map((g) => ({ g, n: open.filter((t) => groupOf(t) === g).length }))
  const maxGroup = Math.max(1, ...byGroup.map((b) => b.n))
  const total30 = s.completed.reduce((a, d) => a + d.count, 0)

  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <StatStrip
        className="lg:col-span-12"
        items={[
          { label: "Open tasks", value: s.open },
          { label: "Overdue", value: s.overdue, tone: s.overdue ? "warn" : undefined },
          { label: "Done this week", value: s.thisWeek, sub: `last week ${s.lastWeek}` },
          { label: "Task streak", value: s.doneStreak, sub: "days in a row" },
          { label: "Log streak", value: s.logStreak, sub: "days in a row" },
          { label: "Logs, 30 days", value: `${s.logsLast30} / 30` },
        ]}
      />
      <Panel tool="tasks" command="completed --30d" meta={`${total30} total`} className="lg:col-span-8" bodyClassName="px-3.5 py-3">
        <CompletedChart data={s.completed} className="h-44" />
      </Panel>
      <Panel tool="tasks" command="open --by-due" meta={open.length} className="lg:col-span-4" bodyClassName="px-3.5 py-3">
        {open.length ? (
          <ul className="space-y-2.5">
            {byGroup.map(({ g, n }) => <BarRow key={g} label={g} value={n} max={maxGroup} tone={g === "Overdue" ? "warn" : undefined} />)}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">No open tasks.</p>
        )}
      </Panel>
      <Panel tool="log" command="heatmap --52w" meta="Mon–Sun, top to bottom · click a day to open it" className="lg:col-span-12" bodyClassName="overflow-x-auto px-3.5 py-3">
        <JournalHeatmap logWords={s.logWords} weeks={52} cell="size-3" />
      </Panel>
    </div>
  )
}

/** Productivity → Insights: worked out from your own tasks and logs. */
export function InsightsPage() {
  return (
    <>
      <PageHeader title="Insights" subtitle="Worked out from your own tasks and daily logs, in this browser." />
      <PersonalAnalytics />
    </>
  )
}

/** CMS → Site analytics: your website's traffic through the analytics connection. */
export function SiteAnalyticsPage() {
  return (
    <>
      <PageHeader title="Site analytics" subtitle="Your website's visitors, pages and referrers, through your analytics connection." />
      <WebsiteAnalytics />
    </>
  )
}
