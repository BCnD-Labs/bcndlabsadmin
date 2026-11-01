import { ExternalLink, GitBranch, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { DataTable, ListRow } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectTag } from "@/components/common/tags"
import { ACTIVITY_ICON } from "@/features/home/dev-attention"
import { timeAgo } from "@/lib/dates"
import type { RepoLink } from "@/lib/types"
import { useDevelopment } from "@/services/data"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

export function ReposPage() {
  const repos = useWorkspace((s) => s.repos)
  const feed = useDevelopment()
  const projects = useProjectMap()
  const openForm = useUi((s) => s.openForm)
  const track = () => openForm({ kind: "repo" })

  return (
    <>
      <PageHeader
        title="Repositories"
        subtitle="Repositories you track. Checks, issues and activity load through your GitHub connection."
        actions={<Button size="lg" onClick={track}><Plus /> Track repository</Button>}
      />
      <div className="grid gap-3 lg:grid-cols-12">
        <Panel tool="repos" command="tracked" meta={repos.length || undefined} className="lg:col-span-7">
          {repos.length ? (
            <DataTable<RepoLink>
              label="Tracked repositories"
              rows={repos}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "name",
                  header: "Repository",
                  cell: (r) => (
                    <a href={r.url} target="_blank" rel="noreferrer" className="group/a inline-flex min-w-0 items-center gap-1.5 font-mono text-ink hover:underline">
                      <span className="break-all">{r.fullName}</span>
                      <ExternalLink className="size-3 shrink-0 text-faint group-hover/a:text-ink-2" aria-label="opens GitHub" />
                    </a>
                  ),
                },
                { key: "project", header: "Project", optional: true, cell: (r) => <ProjectTag project={r.projectId ? projects.get(r.projectId) : undefined} /> },
                {
                  key: "edit",
                  header: <span className="sr-only">Edit</span>,
                  align: "right",
                  className: "w-12",
                  cell: (r) => (
                    <Button variant="quiet" size="icon-sm" aria-label={`Edit ${r.fullName}`} onClick={() => openForm({ kind: "repo", id: r.id })}><Pencil /></Button>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState icon={GitBranch} title="No repositories tracked" action={<Button variant="outline" onClick={track}><Plus /> Track repository</Button>}>
              Add the ones you work on; their links and activity show up here.
            </EmptyState>
          )}
        </Panel>
        <Panel
          tool="github"
          command="activity"
          badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />}
          className="lg:col-span-5"
        >
          {hasData(feed) ? (
            feed.data.activity.length ? (
              <ul>
                {feed.data.activity.map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind]
                  return (
                    <ListRow key={a.id} className="items-start py-2">
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px]">{a.summary}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{a.repo} · {a.actor} · {timeAgo(a.at)}</span>
                      </span>
                    </ListRow>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="No recent activity" />
            )
          ) : (
            <FeedFallback feed={feed} provider="github" what="repository activity" />
          )}
        </Panel>
      </div>
    </>
  )
}
