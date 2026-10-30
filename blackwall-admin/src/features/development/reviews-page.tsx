import { CircleDot, GitPullRequest, RotateCw, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel } from "@/components/common/panel"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { SourceBadge } from "@/components/common/source-badge"
import { CHECK_STYLE, ExtLink } from "@/features/home/dev-attention"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useDevelopment } from "@/services/data"

export function ReviewsPage() {
  const feed = useDevelopment()
  const badge = <SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />
  const header = (
    <PageHeader
      title="Reviews & issues"
      badge={badge}
      description="Open pull requests involving you, plus failed runs and issues on tracked repositories."
      actions={feed.status === "live" && <Button variant="outline" size="sm" onClick={feed.refresh}><RotateCw /> Refresh</Button>}
    />
  )
  if (!hasData(feed)) {
    return (
      <>
        {header}
        <div className="brutal rounded-xl bg-card"><FeedFallback feed={feed} provider="github" what="pull requests, failed checks and issues" /></div>
      </>
    )
  }
  const { prs, failures, issues } = feed.data
  return (
    <>
      {header}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Pull requests" icon={<GitPullRequest />}>
          <ul className="py-1">
            {prs.map((p) => (
              <li key={p.id} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <GitPullRequest className={cn("mt-0.5 size-4 shrink-0", CHECK_STYLE[p.checks])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <ExtLink href={p.url} className="block">{p.title}</ExtLink>
                  <span className="font-mono text-xs text-muted-foreground">{p.repo}#{p.number} · {p.author} · {timeAgo(p.updatedAt)}</span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block text-muted-foreground">{p.kind === "review-requested" ? "Review requested" : "Yours"}</span>
                  {p.checks !== "unknown" && <span className={CHECK_STYLE[p.checks]}>Checks {p.checks}</span>}
                </span>
              </li>
            ))}
            {prs.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No open pull requests involving you.</p>}
          </ul>
        </Panel>
        <Panel title="Failed checks" icon={<XCircle />}>
          <ul className="py-1">
            {failures.map((f) => (
              <li key={f.id} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-text" aria-hidden />
                <span className="min-w-0 flex-1">
                  <ExtLink href={f.url} className="block"><span className="font-mono">{f.workflow}</span> failed on <span className="font-mono">{f.branch}</span></ExtLink>
                  <span className="font-mono text-xs text-muted-foreground">{f.repo}@{f.commit} · {timeAgo(f.failedAt)}</span>
                </span>
              </li>
            ))}
            {failures.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Latest runs are passing.</p>}
          </ul>
        </Panel>
        <Panel title="Open issues" icon={<CircleDot />} className="lg:col-span-2">
          <ul className="py-1">
            {issues.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2.5 px-3 py-2 text-sm">
                <CircleDot className="size-4 text-teal" aria-hidden />
                <ExtLink href={i.url} className="min-w-0 flex-1">{i.title}</ExtLink>
                {i.labels.map((l) => (
                  <span key={l} className="rounded-sm border px-1.5 text-xs text-muted-foreground">{l}</span>
                ))}
                <span className="font-mono text-xs text-muted-foreground">{i.repo}#{i.number} · {timeAgo(i.updatedAt)}</span>
              </li>
            ))}
            {issues.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No open issues on tracked repositories.</p>}
          </ul>
        </Panel>
      </div>
    </>
  )
}
