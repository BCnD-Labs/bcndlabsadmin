import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useWorkspace } from "@/stores/workspace"
import { GROUP_ORDER, groupOf } from "@/features/work/task-utils"
import { CompletedChart, JournalHeatmap, Stat } from "./personal-charts"
import { usePersonalStats } from "./personal-stats"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { DataTable } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ViewTabs } from "@/components/common/view-tabs"
import { cn } from "@/lib/utils"
import { useAnalytics } from "@/services/data"
import type { TrafficRange } from "@/services/types"
import { RangeToggle, TrafficChart, TrafficSummary } from "./traffic-chart"

const fmt = new Intl.NumberFormat("en")

/** A labelled horizontal bar for small breakdowns (referrers, open tasks by due date). */
function BarRow({ label, value, max, tone }: { label: string; value: number; max: number; tone?: "warn" }) {
  return (
    <li className="grid grid-cols-[minmax(0,7rem)_1fr_3rem] items-center gap-3 text-xs">
      <span className={cn("truncate", tone === "warn" && value ? "text-amber" : "text-muted-foreground")} title={label}>{label}</span>
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
      <Panel tool="site" command="traffic" badge={badge}>
        <FeedFallback feed={feed} provider="analytics" what="visitors, pageviews, top pages and referrers" />
      </Panel>
    )
  }

  const { traffic, pages, referrers } = feed.data
  const maxRef = Math.max(1, ...referrers.map((r) => r.visitors))
  const showVisitors = pages.some((p) => p.visitors > 0)

  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Panel tool="site" command={`traffic --${range}d`} badge={badge} actions={<RangeToggle value={range} onChange={setRange} />} className="lg:col-span-12" bodyClassName="flex flex-col gap-3 px-3.5 py-3">
        <TrafficSummary data={traffic} />
        <TrafficChart data={traffic} range={range} className="h-80" />
      </Panel>
      <Panel tool="site" command="top-pages" className="lg:col-span-7">
        {pages.length ? (
          <DataTable
            label="Top pages"
            rows={pages}
            rowKey={(p) => p.path}
            columns={[
              { key: "path", header: "Path", cell: (p) => <span className="font-mono break-all">{p.path}</span> },
              { key: "views", header: "Pageviews", align: "right", cell: (p) => <span className="font-mono tabular-nums">{fmt.format(p.pageviews)}</span> },
              ...(showVisitors
                ? [{ key: "visitors", header: "Visitors", align: "right" as const, optional: true, cell: (p: (typeof pages)[number]) => <span className="font-mono tabular-nums">{fmt.format(p.visitors)}</span> }]
                : []),
            ]}
          />
        ) : (
          <p className="px-3.5 py-3 text-[11px] text-muted-foreground">No page data for this range.</p>
        )}
      </Panel>
      <Panel tool="site" command="referrers" meta="visitors" className="lg:col-span-5" bodyClassName="px-3.5 py-3">
        {referrers.length ? (
          <ul className="space-y-2.5">
            {referrers.map((r) => <BarRow key={r.source} label={r.source} value={r.visitors} max={maxRef} />)}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">No referrer data for this range.</p>
        )}
      </Panel>
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
      <Panel tool="you" command="stats" meta="this browser" className="lg:col-span-12">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 px-3.5 py-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Open tasks" value={s.open} />
          <Stat label="Overdue" value={s.overdue} tone={s.overdue ? "warn" : undefined} />
          <Stat label="Done this week" value={s.thisWeek} sub={`last week ${s.lastWeek}`} />
          <Stat label="Task streak" value={s.doneStreak} sub="days" />
          <Stat label="Log streak" value={s.logStreak} sub="days" />
          <Stat label="Logs, 30 days" value={s.logsLast30} sub="/ 30" />
        </dl>
      </Panel>
      <Panel tool="tasks" command="completed --30d" meta={`${total30} total`} className="lg:col-span-8" bodyClassName="px-3.5 py-3">
        <CompletedChart data={s.completed} className="h-64" />
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
      <Panel tool="log" command="heatmap --26w" className="lg:col-span-12" bodyClassName="px-3.5 py-3">
        <p className="mb-3 text-[11px] text-muted-foreground">Monday to Sunday, top to bottom. Click a day to open its log.</p>
        <JournalHeatmap logWords={s.logWords} weeks={26} cell="size-4" />
      </Panel>
    </div>
  )
}

export function AnalyticsPage() {
  const [params] = useSearchParams()
  const view = params.get("view") === "website" ? "website" : "you"
  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={view === "you" ? "Worked out from your own tasks and daily logs, in this browser." : "Your website's traffic, through your analytics connection."}
      />
      <ViewTabs
        label="Analytics view"
        items={[
          { label: "You", to: "/analytics", active: view === "you" },
          { label: "Website", to: "/analytics?view=website", active: view === "website" },
        ]}
      />
      {view === "website" ? <WebsiteAnalytics /> : <PersonalAnalytics />}
    </>
  )
}
