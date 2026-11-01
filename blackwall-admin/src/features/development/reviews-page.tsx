import { CircleDot, GitPullRequest, RotateCw, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { ListRow } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { StatusMarker } from "@/components/common/tags"
import { CHECK_TONE, ExtLink } from "@/features/home/dev-attention"
import { timeAgo } from "@/lib/dates"
import { useDevelopment } from "@/services/data"

const Quiet = ({ children }: { children: string }) => <p className="px-3.5 py-3 text-[11px] text-muted-foreground">{children}</p>

export function ReviewsPage() {
  const feed = useDevelopment()
  const header = (
    <PageHeader
      title="Reviews & issues"
      badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />}
      subtitle="Open pull requests involving you, plus failed runs and issues on tracked repositories."
      actions={feed.status === "live" && <Button variant="outline" size="lg" onClick={feed.refresh}><RotateCw /> Refresh</Button>}
    />
  )
  if (!hasData(feed)) {
    return (
      <>
        {header}
        <Panel tool="github" command="reviews">
          <FeedFallback feed={feed} provider="github" what="pull requests, failed checks and issues" />
        </Panel>
      </>
    )
  }
  const { prs, failures, issues } = feed.data
  return (
    <>
      {header}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel tool="github" command="prs" meta={prs.length}>
          {prs.length ? (
            <ul>
              {prs.map((p) => (
                <ListRow key={p.id} className="items-start py-2">
                  <GitPullRequest className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <ExtLink href={p.url} className="block text-[13px]">{p.title}</ExtLink>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{p.repo}#{p.number} · {p.author} · {timeAgo(p.updatedAt)}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                    <span className="block">{p.kind === "review-requested" ? "Review requested" : "Yours"}</span>
                    {p.checks !== "unknown" && (
                      <span className="mt-0.5 inline-flex items-center gap-1.5">
                        <StatusMarker tone={CHECK_TONE[p.checks]} /> Checks {p.checks}
                      </span>
                    )}
                  </span>
                </ListRow>
              ))}
            </ul>
          ) : (
            <Quiet>No open pull requests involving you.</Quiet>
          )}
        </Panel>
        <Panel tool="github" command="failures" meta={failures.length}>
          {failures.length ? (
            <ul>
              {failures.map((f) => (
                <ListRow key={f.id} className="items-start py-2">
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-red" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <ExtLink href={f.url} className="block text-[13px]"><span className="font-mono">{f.workflow}</span> failed on <span className="font-mono">{f.branch}</span></ExtLink>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{f.repo}@{f.commit} · {timeAgo(f.failedAt)}</span>
                  </span>
                </ListRow>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-3.5 py-3 text-[11px] text-muted-foreground"><StatusMarker tone="ok" /> Latest runs are passing.</p>
          )}
        </Panel>
        <Panel tool="github" command="issues" meta={issues.length} className="lg:col-span-2">
          {issues.length ? (
            <ul>
              {issues.map((i) => (
                <ListRow key={i.id} className="flex-wrap py-2">
                  <CircleDot className="size-3.5 shrink-0 text-faint" aria-hidden />
                  <ExtLink href={i.url} className="min-w-0 flex-1 text-[13px]">{i.title}</ExtLink>
                  {i.labels.map((l) => (
                    <span key={l} className="rounded-[4px] border border-rim px-1.5 py-px text-[10px] text-muted-foreground">{l}</span>
                  ))}
                  <span className="font-mono text-[11px] text-muted-foreground">{i.repo}#{i.number} · {timeAgo(i.updatedAt)}</span>
                </ListRow>
              ))}
            </ul>
          ) : (
            <Quiet>No open issues on tracked repositories.</Quiet>
          )}
        </Panel>
      </div>
    </>
  )
}
