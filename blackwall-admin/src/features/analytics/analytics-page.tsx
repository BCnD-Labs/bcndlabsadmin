import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { plannerHref } from "@/lib/routes"
import { useWorkspace } from "@/stores/workspace"
import { GROUP_ORDER, groupOf } from "@/features/work/task-utils"
import { CompletedChart, JournalHeatmap } from "./personal-charts"
import { usePersonalStats } from "./personal-stats"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { cn } from "@/lib/utils"
import { useConnections } from "@/services/connector"
import { useAnalytics, useSiteAnalytics } from "@/services/data"
import { selectSite } from "@/features/cms/use-cms"
import { cmsPagesHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import type { TrafficRange } from "@/services/types"
import { DailyBars, RangeToggle } from "./traffic-chart"
import { StatStrip } from "@/components/common/stat-strip"
import { format } from "date-fns"
import { parseKey } from "@/lib/dates"

const fmt = new Intl.NumberFormat("en")

/** A labelled horizontal bar for small breakdowns (referrers, open tasks by due date). */
function BarRow({ label, value, max, tone, mono }: { label: string; value: number; max: number; tone?: "warn"; mono?: boolean }) {
  return (
    <li className={cn("grid items-center gap-3 text-xs", mono ? "grid-cols-[minmax(0,1fr)_minmax(5rem,40%)_2rem]" : "grid-cols-[minmax(0,7rem)_1fr_3rem]")}>
      <span className={cn("truncate", mono && "font-mono text-[11px] text-ink-2", tone === "warn" && value ? "text-amber" : !mono && "text-muted-foreground")} title={label}>{label}</span>
      <span className="h-2 rounded-[2px] bg-off">
        <span className={cn("block h-full rounded-[2px]", tone === "warn" ? "bg-amber" : "bg-[var(--bw-category)]")} style={{ width: `${(value / max) * 100}%` }} />
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
      <WorkspaceGrid><GridItem span={2}><Panel category="analytics" title="Website traffic" tool="site" command="traffic" badge={badge}>
        <FeedFallback feed={feed} provider="analytics" what="visitors, pageviews, top pages and referrers" />
      </Panel></GridItem></WorkspaceGrid>
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
    <WorkspaceGrid>
      <GridItem span="full">
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        <span className="text-[11px] text-muted-foreground">Last {range} days, ending yesterday</span>
        <RangeToggle value={range} onChange={setRange} className="ml-auto" />
      </div>
      </GridItem>
      <GridItem span="full"><StatStrip
        items={[
          { label: "Visitors", value: fmt.format(visitors), sub: `${(visitors / range).toFixed(1)} a day on average` },
          { label: "Pageviews", value: fmt.format(pageviews), sub: visitors ? `${(pageviews / visitors).toFixed(1)} pages per visit` : undefined },
          { label: "Days with visits", value: `${activeDays} / ${range}` },
          { label: "Busiest day", value: busiest.visitors ? format(parseKey(busiest.date), "MMM d") : "—", sub: busiest.visitors ? `${busiest.visitors} visitors` : undefined },
        ]}
      /></GridItem>
      <GridItem span="full"><Panel category="analytics" title="Daily visitors" tool="site" command={`visitors --${range}d`} bodyClassName="px-2 pt-2 pb-1.5">
        <DailyBars data={traffic} range={range} className="h-40 w-full" />
      </Panel></GridItem>
      <GridItem span={2}><Panel category="analytics" title="Top pages" tool="site" command="pages" meta="views" bodyClassName="px-3.5 py-3">
        {pages.length ? (
          <ul className="space-y-2.5">
            {pages.slice(0, 8).map((p) => <BarRow key={p.path} label={p.path} value={p.pageviews} max={maxPage} mono />)}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">No page views in this range.</p>
        )}
      </Panel></GridItem>
      <GridItem span={2}><Panel category="analytics" title="Referrers" tool="site" command="referrers" meta="visitors" bodyClassName="px-3.5 py-3">
        {referrers.length ? (
          <ul className="space-y-2.5">
            {referrers.slice(0, 8).map((r) => <BarRow key={r.source} label={r.source} value={r.visitors} max={maxRef} />)}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">No referrers in this range.</p>
        )}
      </Panel></GridItem>
    </WorkspaceGrid>
  )
}

function PersonalAnalytics() {
  const s = usePersonalStats(30)
  const tasks = useWorkspace((st) => st.tasks)
  const open = tasks.filter((t) => !t.done)
  const byGroup = GROUP_ORDER.map((g) => ({ g, n: open.filter((t) => groupOf(t) === g).length }))
  const maxGroup = Math.max(1, ...byGroup.map((b) => b.n))
  const total30 = s.completed.reduce((a, d) => a + d.count, 0)

  if (!tasks.length && ![...s.logWords.values()].some(Boolean)) {
    return <WorkspaceGrid><GridItem span={2}><Panel category="tasks" title="Activity insights" tool="activity" command="overview">
      <EmptyState roomy title="Your activity will take shape here" action={<Button variant="outline" asChild><Link to={plannerHref}>Open Planner</Link></Button>}>
        Add tasks or write a daily log to see your progress and patterns over time.
      </EmptyState>
    </Panel></GridItem></WorkspaceGrid>
  }

  return (
    <WorkspaceGrid>
      <GridItem span="full">
      <StatStrip

        items={[
          { label: "Done this week", value: s.thisWeek, sub: `last week ${s.lastWeek}` },
          { label: "Task streak", value: s.doneStreak, sub: "days in a row" },
          { label: "Log streak", value: s.logStreak, sub: "days in a row" },
          { label: "Logs, 30 days", value: `${s.logsLast30} / 30` },
        ]}
      />
      </GridItem>
      <GridItem span={2}><Panel category="tasks" title="Completed tasks" tool="tasks" command="completed --30d" meta={`${total30} total`}  bodyClassName="px-3.5 py-3">
        <CompletedChart data={s.completed} className="h-44 lg:h-36" />
      </Panel></GridItem>
      <GridItem span={2}><Panel category="tasks" title="Open work" tool="tasks" command="open --by-due" meta={open.length}  bodyClassName="px-3.5 py-3">
        {open.length ? (
          <ul className="space-y-2.5">
            {byGroup.map(({ g, n }) => <BarRow key={g} label={g} value={n} max={maxGroup} tone={g === "Overdue" ? "warn" : undefined} />)}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">No open tasks.</p>
        )}
      </Panel></GridItem>
      <GridItem span={3}><Panel category="journal" title="Daily log history" tool="log" command="heatmap --52w" meta="Mon–Sun, top to bottom · click a day to open it"  bodyClassName="min-w-0 px-3.5 py-3">
        <JournalHeatmap logWords={s.logWords} weeks={52} cell="size-3" />
      </Panel></GridItem>
    </WorkspaceGrid>
  )
}

const countryNames = new Intl.DisplayNames(["en"], { type: "region" })
const countryName = (code: string) => { try { return countryNames.of(code) ?? code } catch { return code } }

/** One site's last 30 days, from the analytics source mapped to it. With none, it says so rather than showing anything. */
function SiteTrafficCard({ site }: { site: Site }) {
  const traffic = useSiteAnalytics(site)
  const navigate = useNavigate()
  const settings = () => { selectSite(site.id); navigate(`${cmsPagesHref}?panel=settings`) }
  const meta = traffic.state === "unmapped" ? undefined : traffic.source
  return (
    <GridItem span={2}>
      <Panel category="website" title={site.name} meta={meta} bodyClassName="grid gap-3 px-3.5 py-3" data-testid="site-traffic">
        {traffic.state === "unmapped" && <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground"><span className="min-w-0 flex-1">No analytics source is mapped to this site, so there are no numbers to show.</span><Button variant="outline" size="xs" onClick={settings}>Site settings</Button></div>}
        {traffic.state === "loading" && <p className="text-[13px] text-muted-foreground">Loading…</p>}
        {traffic.state === "error" && <div className="flex flex-wrap items-center gap-2 text-[13px] text-red-text"><span className="min-w-0 flex-1">Couldn't get this site's numbers: {traffic.message}</span><Button variant="outline" size="xs" onClick={settings}>Site settings</Button></div>}
        {traffic.state === "live" && (() => {
          const { traffic: days, referrers, countries } = traffic.data
          const visits = days.reduce((n, p) => n + p.visitors, 0)
          const maxRef = Math.max(1, ...referrers.map((r) => r.visitors))
          const maxPlace = Math.max(1, ...(countries ?? []).map((c) => c.visitors))
          return (
            <>
              <p className="text-[13px] text-ink-2"><b className="text-lg text-ink tabular-nums">{fmt.format(visits)}</b> visits in the last 30 days</p>
              <div className="grid gap-4 @lg:grid-cols-2">
                <div><h3 className="bw-label mb-1.5">Referrers</h3>{referrers.length ? <ul className="grid gap-1.5">{referrers.slice(0, 5).map((r) => <BarRow key={r.source} label={r.source} value={r.visitors} max={maxRef} />)}</ul> : <p className="text-xs text-muted-foreground">None in this period.</p>}</div>
                <div><h3 className="bw-label mb-1.5">Countries</h3>{countries?.length ? <ul className="grid gap-1.5">{countries.slice(0, 5).map((c) => <BarRow key={c.country} label={countryName(c.country)} value={c.visitors} max={maxPlace} />)}</ul> : <p className="text-xs text-muted-foreground">{countries ? "None in this period." : "This source doesn't report countries."}</p>}</div>
              </div>
            </>
          )
        })()}
      </Panel>
    </GridItem>
  )
}

function SiteTrafficCards() {
  const sites = useWorkspace((s) => s.sites)
  useEffect(() => { void useConnections.getState().refresh() }, [])
  const own = sites.filter((s) => !s.template)
  return own.length ? <div className="mt-[var(--bw-grid-gap)]"><WorkspaceGrid>{own.map((s) => <SiteTrafficCard key={s.id} site={s} />)}</WorkspaceGrid></div> : null
}

/** Productivity → Insights: worked out from your own tasks and logs. */
export function InsightsPage() {
  return (
    <>
      <PageHeader title="Activity insights" />
      <PersonalAnalytics />
      <SiteTrafficCards />
    </>
  )
}

/** CMS → Site analytics: your website's traffic through the analytics connection. */
export function SiteAnalyticsPage() {
  return (
    <>
      <PageHeader title="Website traffic" />
      <WebsiteAnalytics />
    </>
  )
}
