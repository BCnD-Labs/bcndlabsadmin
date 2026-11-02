import { format } from "date-fns"
import { CircleDot, GitBranch, GitPullRequest, XCircle } from "lucide-react"
import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { SourceBadge } from "@/components/common/source-badge"
import { StatusMarker } from "@/components/common/tags"
import { hasData } from "@/components/common/feed-fallback"
import { DailyBars } from "@/features/analytics/traffic-chart"
import { PostStateChip } from "@/features/content/content-page"
import { CoverPlaceholder, SiteImage } from "@/features/content/site-image"
import { CalendarLegend, JournalCalendar } from "@/features/journal/journal-calendar"
import { TaskRow } from "@/features/work/task-row"
import { compareTasks } from "@/features/work/task-utils"
import { shortAgo, todayKey } from "@/lib/dates"
import { DEVELOPMENT, draftHref, logHref, postsHref, siteAnalyticsHref } from "@/lib/routes"
import { useAnalytics, useDevelopment } from "@/services/data"
import { mergePosts, useSite } from "@/services/site"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

const Footer = ({ to, children }: { to: string; children: string }) => (
  <div className="mt-auto border-t border-line-soft px-3.5 py-1.5 text-right">
    <Link to={to} className="text-[11px] text-ink-2 underline-offset-2 hover:underline">{children} →</Link>
  </div>
)

const Mini = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "error" }) => (
  <div className="flex min-w-0 flex-1 flex-col px-3 py-2">
    <span className="truncate text-[10px] text-muted-foreground">{label}</span>
    <span className={tone === "error" ? "font-heading text-lg leading-tight font-bold text-red-text" : "font-heading text-lg leading-tight font-bold"}>{value}</span>
  </div>
)

/* ---------------------------------------------------------------- calendar */

export function CalendarMeta() {
  return <>{format(new Date(), "EEE MMM d")}</>
}

/** Month calendar and what's due today; a day opens it in the Planner. */
export function HomeCalendarPanel() {
  const navigate = useNavigate()
  const today = todayKey()
  const due = useWorkspace((s) => s.tasks.filter((t) => !t.done && t.due === today)).sort(compareTasks)
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-1 border-b border-line px-2 pt-1 pb-2 sm:border-r sm:border-b-0">
        <JournalCalendar selected={today} onSelect={(d) => navigate(logHref(d))} />
        <CalendarLegend />
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <h3 className="bw-label px-3 pt-2.5 pb-1">Due today · {due.length}</h3>
        {due.length ? (
          <ul className="max-h-60 min-h-0 overflow-y-auto">{due.map((t) => <TaskRow key={t.id} task={t} dense hideDate />)}</ul>
        ) : (
          <p className="px-3 text-[11px] text-muted-foreground">Nothing due today.</p>
        )}
        <Footer to={logHref(today)}>Open today</Footer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- development */

export function DevelopmentMeta() {
  const feed = useDevelopment()
  return <SourceBadge status={feed.status} />
}

export function HomeDevelopmentPanel() {
  const feed = useDevelopment()
  const repos = useWorkspace((s) => s.repos)
  const data = hasData(feed) ? feed.data : undefined
  const dash = <span className="text-faint">—</span>
  const items = data
    ? [
        ...data.prs.filter((p) => p.kind === "review-requested").map((p) => ({ id: p.id, icon: <GitPullRequest className="size-3.5 text-faint" aria-hidden />, title: p.title, meta: `${p.repo}#${p.number}`, at: p.updatedAt, url: p.url })),
        ...data.failures.map((f) => ({ id: f.id, icon: <XCircle className="size-3.5 text-red" aria-hidden />, title: `${f.workflow} failed on ${f.branch}`, meta: f.repo, at: f.failedAt, url: f.url })),
        ...data.issues.map((i) => ({ id: i.id, icon: <CircleDot className="size-3.5 text-faint" aria-hidden />, title: i.title, meta: `${i.repo}#${i.number}`, at: i.updatedAt, url: i.url })),
      ].slice(0, 5)
    : []
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex divide-x divide-line border-b border-line">
        <Mini label="Repos" value={repos.length} />
        <Mini label="Open PRs" value={data ? data.prs.length : dash} />
        <Mini label="Failed runs" value={data ? data.failures.length : dash} tone={data?.failures.length ? "error" : undefined} />
        <Mini label="Issues" value={data ? data.issues.length : dash} />
      </div>
      {data ? (
        items.length ? (
          <ul className="max-h-60 min-h-0 overflow-y-auto">
            {items.map((it) => (
              <li key={it.id} className="flex min-h-10 items-center gap-2.5 border-b border-line-soft px-3 py-1.5 last:border-b-0">
                {it.icon}
                <span className="min-w-0 flex-1">
                  {it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="block truncate text-[13px] text-ink hover:underline">{it.title}</a> : <span className="block truncate text-[13px] text-ink">{it.title}</span>}
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{it.meta} · {shortAgo(it.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground"><StatusMarker tone="ok" /> Nothing needs you.</p>
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5">
          <ul className="flex flex-col gap-1">
            {repos.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[13px]">
                <GitBranch className="size-3.5 text-faint" aria-hidden />
                <a href={r.url} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-ink-2 hover:text-ink hover:underline">{r.fullName}</a>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">Connect GitHub for review requests, failed runs and issues.</p>
          <Button variant="outline" size="sm" className="self-start" onClick={() => useUi.getState().openSettings("connections", "github")}>Connect GitHub</Button>
        </div>
      )}
      <Footer to={DEVELOPMENT}>Development</Footer>
    </div>
  )
}

/* ----------------------------------------------------------------- website */

export function WebsiteMeta() {
  const site = useSite()
  return <SourceBadge status={site.status} />
}

/** Latest posts with their covers, what's scheduled, and a small visitors chart. */
export function HomeWebsitePanel() {
  const site = useSite()
  const drafts = useWorkspace((s) => s.drafts)
  const traffic = useAnalytics(30)
  const items = useMemo(() => mergePosts(drafts, site.overview).slice(0, 4), [drafts, site.overview])
  const visitors = traffic.data?.traffic.reduce((a, p) => a + p.visitors, 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {items.length ? (
        <ul className="max-h-60 min-h-0 overflow-y-auto">
          {items.map((i) => (
            <li key={i.key} className="border-b border-line-soft last:border-b-0">
              <Link to={i.draft ? draftHref(i.draft.id) : postsHref} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-raised">
                {i.cover ? <SiteImage path={i.cover} siteUrl={site.overview?.siteUrl} className="h-9 w-14 shrink-0 rounded-[5px]" /> : <CoverPlaceholder title={i.title} className="h-9 w-14 shrink-0 rounded-[5px] text-xs" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{i.title}</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-faint">
                    <PostStateChip state={i.state} />
                    {i.date && format(new Date(i.date), "MMM d")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground">No posts yet.</p>
      )}
      <div className="flex items-end gap-3 border-t border-line px-3 pt-2 pb-1.5">
        <div className="shrink-0">
          <Link to={siteAnalyticsHref} className="block text-[10px] text-muted-foreground hover:text-ink">Visitors · 30d</Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg leading-tight font-bold">{visitors ?? <span className="text-faint">—</span>}</span>
            <SourceBadge status={traffic.status} hint={traffic.status === "sample" ? "Sample analytics; website content has its own connection status above." : undefined} />
          </div>
        </div>
        {traffic.data && <DailyBars data={traffic.data.traffic} range={30} bare className="h-10 min-w-0 flex-1" />}
      </div>
      <Footer to={postsHref}>Posts & pages</Footer>
    </div>
  )
}
