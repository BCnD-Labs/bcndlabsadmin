import { CircleDot, ExternalLink, GitMerge, GitPullRequest, Rocket, Upload, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { SourceBadge } from "@/components/common/source-badge"
import type { Tone } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useDevelopment } from "@/services/data"
import type { PullRequestSummary, RepoActivity } from "@/services/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

/** Check state as text colour, for the icon only: green would read as a link, so passing stays neutral. */
export const CHECK_STYLE: Record<PullRequestSummary["checks"], string> = {
  passing: "text-ink-2",
  failing: "text-red-text",
  pending: "text-amber",
  unknown: "text-faint",
}

/** Check state as a status marker (spec §6). */
export const CHECK_TONE: Record<PullRequestSummary["checks"], Tone> = {
  passing: "ok",
  failing: "error",
  pending: "warn",
  unknown: "off",
}

export const ACTIVITY_ICON: Record<RepoActivity["kind"], typeof Upload> = {
  push: Upload,
  merge: GitMerge,
  release: Rocket,
  issue: CircleDot,
}

/** Title that links out when the item has a URL (live data), plain text otherwise. */
export function ExtLink({ href, children, className }: { href?: string; children: ReactNode; className?: string }) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("group/ext hover:underline", className)}>
      {children}
      <ExternalLink className="ml-1 inline size-3 opacity-0 group-hover/ext:opacity-70" aria-hidden />
    </a>
  )
}

const short = (iso: string) => timeAgo(iso).replace(" ago", "")

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="py-1.5">
      <h3 className="bw-label flex items-center gap-2 px-3 pb-1">
        {title}
        <span className="font-mono text-[0.68rem] text-foreground tabular-nums">{count}</span>
      </h3>
      {children}
    </div>
  )
}

export function DevAttention({ className }: { className?: string }) {
  const repos = useWorkspace((s) => s.repos)
  const feed = useDevelopment()
  const openForm = useUi((s) => s.openForm)

  const body = () => {
    if (!hasData(feed)) return <FeedFallback feed={feed} provider="github" what="review requests and failed checks" />
    if (repos.length === 0 && feed.data.prs.length === 0) {
      return (
        <EmptyState title="No repositories tracked" action={<Button variant="outline" onClick={() => openForm({ kind: "repo" })}>Track a repository</Button>}>
          Track repositories to see their checks, issues and activity.
        </EmptyState>
      )
    }
    const { prs, failures, activity } = feed.data
    const reviews = prs.filter((p) => p.kind === "review-requested")
    return (
      <div className="divide-y divide-border/60">
        <Section title="Review requested" count={reviews.length}>
          {reviews.length ? (
            <ul>
              {reviews.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                  <GitPullRequest className={cn("size-4 shrink-0", CHECK_STYLE[p.checks])} aria-label={`Checks ${p.checks}`} />
                  <ExtLink href={p.url} className="min-w-0 flex-1 truncate">{p.title}</ExtLink>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{p.repo.split("/")[1]}#{p.number}</span>
                  <span className="w-16 text-right text-xs text-muted-foreground">{short(p.updatedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 text-sm text-muted-foreground">No reviews waiting.</p>
          )}
        </Section>
        <Section title="Failed checks" count={failures.length}>
          {failures.length ? (
            <ul>
              {failures.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                  <XCircle className="size-4 shrink-0 text-red-text" aria-hidden />
                  <ExtLink href={f.url} className="min-w-0 flex-1 truncate">
                    <span className="font-mono text-xs">{f.workflow}</span> on <span className="font-mono text-xs">{f.branch}</span>
                  </ExtLink>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{f.repo.split("/")[1]}@{f.commit}</span>
                  <span className="w-16 text-right text-xs text-muted-foreground">{short(f.failedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 text-sm text-muted-foreground">Latest runs are passing.</p>
          )}
        </Section>
        <Section title="Recent activity" count={activity.length}>
          {activity.length ? (
            <ul>
              {activity.slice(0, 4).map((a) => {
                const Icon = ACTIVITY_ICON[a.kind]
                return (
                  <li key={a.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{a.summary}</span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{a.repo.split("/")[1]}</span>
                    <span className="w-16 text-right text-xs text-muted-foreground">{short(a.at)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-3 text-sm text-muted-foreground">No recent activity.</p>
          )}
        </Section>
      </div>
    )
  }

  return (
    <Panel
      id="development"
      tool="github" command="attention"
      badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />}
      className={className}
      actions={
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to="/development/reviews">Reviews & issues</Link>
        </Button>
      }
    >
      {body()}
    </Panel>
  )
}
