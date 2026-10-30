import { CircleDot, GitPullRequest, XCircle } from "lucide-react"
import { EmptyState, PageHeader, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { CHECK_STYLE, useDevData } from "@/features/home/dev-attention"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { services } from "@/services"

export function ReviewsPage() {
  const { prs, failures, issues } = useDevData()
  const badge = <SourceBadge status={services.development.source.status} />
  return (
    <>
      <PageHeader
        title="Reviews & issues"
        badge={badge}
        description="Sample GitHub data for tracked repositories. Connect GitHub (server-side) to replace it."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Pull requests" icon={<GitPullRequest />} badge={badge}>
          <ul className="py-1">
            {(prs ?? []).map((p) => (
              <li key={p.id} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <GitPullRequest className={cn("mt-0.5 size-4", CHECK_STYLE[p.checks])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block">{p.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.repo}#{p.number} · {p.author} · {timeAgo(p.updatedAt)}
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="block text-muted-foreground">{p.kind === "review-requested" ? "Review requested" : "Yours"}</span>
                  <span className={CHECK_STYLE[p.checks]}>Checks {p.checks}</span>
                </span>
              </li>
            ))}
            {prs?.length === 0 && <EmptyState>No pull requests.</EmptyState>}
          </ul>
        </Panel>
        <Panel title="Failed checks" icon={<XCircle />} badge={badge}>
          <ul className="py-1">
            {(failures ?? []).map((f) => (
              <li key={f.id} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <XCircle className="mt-0.5 size-4 text-red-text" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block"><span className="font-mono">{f.workflow}</span> failed on <span className="font-mono">{f.branch}</span></span>
                  <span className="font-mono text-xs text-muted-foreground">{f.repo}@{f.commit} · {timeAgo(f.failedAt)}</span>
                </span>
              </li>
            ))}
            {failures?.length === 0 && <EmptyState>No failed checks.</EmptyState>}
          </ul>
        </Panel>
        <Panel title="Open issues" icon={<CircleDot />} badge={badge} className="lg:col-span-2">
          <ul className="py-1">
            {(issues ?? []).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2.5 px-3 py-2 text-sm">
                <CircleDot className="size-4 text-teal" aria-hidden />
                <span className="min-w-0 flex-1">{i.title}</span>
                {i.labels.map((l) => (
                  <span key={l} className="rounded-sm border px-1.5 text-xs text-muted-foreground">{l}</span>
                ))}
                <span className="font-mono text-xs text-muted-foreground">{i.repo}#{i.number} · {timeAgo(i.updatedAt)}</span>
              </li>
            ))}
            {issues?.length === 0 && <EmptyState>No issues.</EmptyState>}
          </ul>
        </Panel>
      </div>
    </>
  )
}
