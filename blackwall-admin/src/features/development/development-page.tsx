import { CircleDot, ExternalLink, GitBranch, GitPullRequest, Globe, Pencil, Plus, RotateCw, XCircle } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { StatStrip } from "@/components/common/stat-strip"
import { ProjectTag, StatusMarker } from "@/components/common/tags"
import { ACTIVITY_ICON, CHECK_TONE } from "@/features/home/dev-attention"
import { shortAgo, timeAgo } from "@/lib/dates"
import type { RepoLink } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useDevelopment } from "@/services/data"
import type { DevelopmentOverview } from "@/services/types"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

/**
 * Development: every tracked repository as a small card (status, PRs, issues,
 * links), then what needs you and recent activity. One page instead of three tables.
 */
export function DevelopmentPage() {
  const repos = useWorkspace((s) => s.repos)
  const feed = useDevelopment()
  const openForm = useUi((s) => s.openForm)
  const data = hasData(feed) ? feed.data : undefined
  const track = () => openForm({ kind: "repo" })

  const reviews = data?.prs.filter((p) => p.kind === "review-requested").length ?? 0
  const dash = <span className="text-faint">—</span>

  return (
    <>
      <PageHeader
        title="Development"
        badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />}
        subtitle="Repositories you track, what needs you, and where they're deployed."
        actions={
          <>
            {feed.status === "live" && (
              <Button variant="ghost" onClick={feed.refresh}>
                <RotateCw /> Refresh
              </Button>
            )}
            <Button onClick={track}>
              <Plus /> Track repository
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-3">
        <StatStrip
          items={[
            { label: "Repositories", value: repos.length, icon: <GitBranch className="size-3" aria-hidden /> },
            { label: "Open pull requests", value: data ? data.prs.length : dash, sub: data ? (reviews ? `${reviews} waiting on your review` : "none waiting on you") : undefined, icon: <GitPullRequest className="size-3" aria-hidden /> },
            { label: "Failed runs", value: data ? data.failures.length : dash, tone: data?.failures.length ? "error" : undefined, sub: data && !data.failures.length ? "latest runs passing" : undefined, icon: <XCircle className="size-3" aria-hidden /> },
            { label: "Open issues", value: data ? data.issues.length : dash, icon: <CircleDot className="size-3" aria-hidden /> },
          ]}
        />

        {repos.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Tracked repositories">
            {repos.map((r) => (
              <RepoCard key={r.id} repo={r} data={data} />
            ))}
          </ul>
        ) : (
          <Panel tool="repos" command="ls">
            <EmptyState icon={GitBranch} title="No repositories tracked" action={<Button variant="outline" onClick={track}><Plus /> Track repository</Button>}>
              Add the ones you work on; their status, links and activity show up here.
            </EmptyState>
          </Panel>
        )}

        {data ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Attention data={data} />
            <Activity data={data} />
          </div>
        ) : (
          <Panel tool="github" command="status" className="sm:max-w-none">
            <FeedFallback feed={feed} provider="github" what="pull requests, failed runs, issues and activity" />
          </Panel>
        )}
      </div>
    </>
  )
}

function Pill({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-[6px] border border-line bg-well px-2 text-[11px] text-ink-2 hover:border-rim hover:text-ink"
    >
      {icon}
      <span className="truncate">{children}</span>
    </a>
  )
}

function RepoCard({ repo, data }: { repo: RepoLink; data?: DevelopmentOverview }) {
  const projects = useProjectMap()
  const openForm = useUi((s) => s.openForm)
  const prs = data?.prs.filter((p) => p.repo === repo.fullName) ?? []
  const failures = data?.failures.filter((f) => f.repo === repo.fullName) ?? []
  const issues = data?.issues.filter((i) => i.repo === repo.fullName) ?? []
  const last = data?.activity.find((a) => a.repo === repo.fullName)
  const [owner, name] = repo.fullName.split("/")
  const tone = !data ? "off" : failures.length ? "error" : prs.some((p) => p.checks === "pending") ? "warn" : "ok"
  const status = !data ? "Status needs GitHub" : failures.length ? `${failures.length} failed ${failures.length === 1 ? "run" : "runs"}` : "Checks passing"

  return (
    <li className="bw-panel flex flex-col gap-2.5 p-3" data-testid="repo-card">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-line bg-well text-muted-foreground">
          <GitBranch className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <a href={repo.url} target="_blank" rel="noreferrer" className="group/a flex min-w-0 items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
            <span className="truncate">{name ?? repo.fullName}</span>
            <ExternalLink className="size-3 shrink-0 text-faint group-hover/a:text-ink-2" aria-label="opens GitHub" />
          </a>
          <p className="truncate font-mono text-[11px] text-faint">{owner}</p>
        </div>
        <ProjectTag project={repo.projectId ? projects.get(repo.projectId) : undefined} />
        <Button variant="quiet" size="icon-xs" aria-label={`Edit ${repo.fullName}`} onClick={() => openForm({ kind: "repo", id: repo.id })}>
          <Pencil />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <StatusMarker tone={tone} /> {status}
        </span>
        {data && (
          <>
            <span className="inline-flex items-center gap-1"><GitPullRequest className="size-3" aria-hidden /> {prs.length}</span>
            <span className="inline-flex items-center gap-1"><CircleDot className="size-3" aria-hidden /> {issues.length}</span>
          </>
        )}
      </div>
      {last && (
        <p className="truncate border-t border-line-soft pt-2 text-[11px] text-muted-foreground" title={last.summary}>
          <span className="text-ink-2">{last.summary}</span> · {shortAgo(last.at)}
        </p>
      )}
      {(repo.productionUrl || repo.previewUrl) && (
        <div className="flex flex-wrap gap-1.5">
          {repo.productionUrl && <Pill href={repo.productionUrl} icon={<Globe className="size-3 shrink-0" aria-hidden />}>{repo.productionUrl.replace(/^https?:\/\//, "")}</Pill>}
          {repo.previewUrl && <Pill href={repo.previewUrl} icon={<span className="text-[9px] font-bold text-faint">PRE</span>}>{repo.previewUrl.replace(/^https?:\/\//, "")}</Pill>}
        </div>
      )}
    </li>
  )
}

type AttentionItem = { id: string; icon: ReactNode; title: ReactNode; meta: string; url?: string; side?: ReactNode; rank: number; at: string }

/** Review requests first, then failed runs, your own PRs and issues. */
function Attention({ data }: { data: DevelopmentOverview }) {
  const [all, setAll] = useState(false)
  const items: AttentionItem[] = [
    ...data.prs.map((p) => ({
      id: p.id,
      icon: <GitPullRequest className="size-3.5 text-faint" aria-hidden />,
      title: p.title,
      meta: `${p.repo}#${p.number} · ${p.author}`,
      url: p.url,
      side: (
        <span className="inline-flex items-center gap-1.5">
          {p.checks !== "unknown" && <StatusMarker tone={CHECK_TONE[p.checks]} />}
          {p.kind === "review-requested" ? "Review" : "Yours"}
        </span>
      ),
      rank: p.kind === "review-requested" ? 0 : 2,
      at: p.updatedAt,
    })),
    ...data.failures.map((f) => ({
      id: f.id,
      icon: <XCircle className="size-3.5 text-red" aria-hidden />,
      title: (
        <>
          <span className="font-mono">{f.workflow}</span> failed on <span className="font-mono">{f.branch}</span>
        </>
      ),
      meta: `${f.repo}@${f.commit}`,
      url: f.url,
      side: "Failed",
      rank: 1,
      at: f.failedAt,
    })),
    ...data.issues.map((i) => ({
      id: i.id,
      icon: <CircleDot className="size-3.5 text-faint" aria-hidden />,
      title: i.title,
      meta: `${i.repo}#${i.number}${i.labels.length ? ` · ${i.labels.join(", ")}` : ""}`,
      url: i.url,
      side: "Issue",
      rank: 3,
      at: i.updatedAt,
    })),
  ].sort((a, b) => a.rank - b.rank || b.at.localeCompare(a.at))
  const shown = all ? items : items.slice(0, 6)

  return (
    <Panel tool="github" command="needs-you" meta={items.length}>
      {items.length ? (
        <>
          <ul>
            {shown.map((it) => {
              const Title = it.url ? "a" : "span"
              return (
                <li key={it.id} className="flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3 py-1.5 last:border-b-0 hover:bg-raised">
                  {it.icon}
                  <span className="min-w-0 flex-1">
                    <Title {...(it.url ? { href: it.url, target: "_blank", rel: "noreferrer" } : {})} className={cn("block truncate text-[13px] text-ink", it.url && "hover:underline")}>
                      {it.title}
                    </Title>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {it.meta} · {shortAgo(it.at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{it.side}</span>
                </li>
              )
            })}
          </ul>
          {items.length > 6 && (
            <button type="button" onClick={() => setAll(!all)} className="w-full border-t border-line px-3 py-2 text-left text-[11px] text-muted-foreground hover:text-ink">
              {all ? "Show less" : `Show all ${items.length}`}
            </button>
          )}
        </>
      ) : (
        <p className="flex items-center gap-2 px-3 py-3 text-[12px] text-muted-foreground">
          <StatusMarker tone="ok" /> Nothing needs you: no review requests, failed runs or open issues.
        </p>
      )}
    </Panel>
  )
}

function Activity({ data }: { data: DevelopmentOverview }) {
  return (
    <Panel tool="github" command="activity" meta={data.activity.length || undefined}>
      {data.activity.length ? (
        <ol className="relative px-3 py-2">
          {data.activity.map((a, i) => {
            const Icon = ACTIVITY_ICON[a.kind]
            return (
              <li key={a.id} className="relative flex gap-2.5 pb-3 last:pb-1">
                {i < data.activity.length - 1 && <span className="absolute top-6 bottom-0 left-[11px] w-px bg-line" aria-hidden />}
                <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-raised">
                  <Icon className="size-3 text-muted-foreground" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="block truncate text-[13px] text-ink">{a.summary}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground" title={timeAgo(a.at)}>
                    {a.repo} · {a.actor} · {shortAgo(a.at)}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="px-3 py-3 text-[12px] text-muted-foreground">No recent activity on tracked repositories.</p>
      )}
    </Panel>
  )
}
