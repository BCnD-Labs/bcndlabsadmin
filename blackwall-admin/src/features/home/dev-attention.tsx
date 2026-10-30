import { AlertCircle, CircleDot, GitMerge, GitPullRequest, Rocket, Upload, XCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { services } from "@/services"
import type { PullRequestSummary, RepoActivity } from "@/services/types"
import { useServiceData } from "@/services/use-service"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

export const CHECK_STYLE: Record<PullRequestSummary["checks"], string> = {
  passing: "text-teal",
  failing: "text-red-text",
  pending: "text-amber",
}

export const ACTIVITY_ICON: Record<RepoActivity["kind"], typeof Upload> = {
  push: Upload,
  merge: GitMerge,
  release: Rocket,
  issue: CircleDot,
}

export function useDevData() {
  const repos = useWorkspace((s) => s.repos)
  const names = repos.map((r) => r.fullName)
  const key = names.join(",")
  const dev = services.development
  const prs = useServiceData(() => dev.getPullRequests(names), [key])
  const failures = useServiceData(() => dev.getFailedChecks(names), [key])
  const issues = useServiceData(() => dev.getIssues(names), [key])
  const activity = useServiceData(() => dev.getActivity(names), [key])
  return { repos, prs, failures, issues, activity }
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <h3 className="eyebrow flex items-center gap-2 px-3 pb-1">
        {title}
        <span className="font-mono text-[0.68rem] text-foreground tabular-nums">{count}</span>
      </h3>
      {children}
    </div>
  )
}

export function DevAttention({ className }: { className?: string }) {
  const { repos, prs, failures, activity } = useDevData()
  const openForm = useUi((s) => s.openForm)
  const reviews = (prs ?? []).filter((p) => p.kind === "review-requested")

  return (
    <Panel
      id="development"
      title="Development attention"
      icon={<GitPullRequest />}
      badge={<SourceBadge status={services.development.source.status} hint="Sample GitHub activity for your tracked repositories. Not live." />}
      className={className}
      actions={
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to="/development/reviews">Reviews & issues</Link>
        </Button>
      }
    >
      {repos.length === 0 ? (
        <EmptyState action={<Button size="sm" variant="outline" onClick={() => openForm({ kind: "repo" })}>Track a repository</Button>}>
          No repositories tracked yet.
        </EmptyState>
      ) : (
        <div className="divide-y divide-border/60">
          <Section title="Review requested" count={reviews.length}>
            {reviews.length ? (
              <ul>
                {reviews.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                    <GitPullRequest className={cn("size-4 shrink-0", CHECK_STYLE[p.checks])} aria-label={`Checks ${p.checks}`} />
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                      {p.repo.split("/")[1]}#{p.number}
                    </span>
                    <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(p.updatedAt).replace(" ago", "")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 text-sm text-muted-foreground">No reviews waiting.</p>
            )}
          </Section>
          <Section title="Failed checks" count={failures?.length ?? 0}>
            {failures?.length ? (
              <ul>
                {failures.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                    <XCircle className="size-4 shrink-0 text-red-text" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-xs">{f.workflow}</span> on{" "}
                      <span className="font-mono text-xs">{f.branch}</span>
                    </span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{f.repo.split("/")[1]}@{f.commit}</span>
                    <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(f.failedAt).replace(" ago", "")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-1.5 px-3 text-sm text-muted-foreground">
                <AlertCircle className="size-4" aria-hidden /> All checks passing.
              </p>
            )}
          </Section>
          <Section title="Recent activity" count={activity?.length ?? 0}>
            <ul>
              {(activity ?? []).slice(0, 4).map((a) => {
                const Icon = ACTIVITY_ICON[a.kind]
                return (
                  <li key={a.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{a.summary}</span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{a.repo.split("/")[1]}</span>
                    <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(a.at).replace(" ago", "")}</span>
                  </li>
                )
              })}
            </ul>
          </Section>
        </div>
      )}
    </Panel>
  )
}
