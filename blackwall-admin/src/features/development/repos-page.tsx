import { ExternalLink, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader, Panel } from "@/components/common/panel"
import { ProjectTag } from "@/components/common/tags"
import { ACTIVITY_ICON } from "@/features/home/dev-attention"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { SourceBadge } from "@/components/common/source-badge"
import { timeAgo } from "@/lib/dates"
import { useDevelopment } from "@/services/data"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

export function ReposPage() {
  const repos = useWorkspace((s) => s.repos)
  const feed = useDevelopment()
  const projects = useProjectMap()
  const openForm = useUi((s) => s.openForm)

  return (
    <>
      <PageHeader
        title="Repositories"
        description="Repositories you track. Checks, issues and activity load through your GitHub connection."
        actions={<Button onClick={() => openForm({ kind: "repo" })}><Plus /> Track repository</Button>}
      />
      <div className="grid gap-3 lg:grid-cols-12">
        <Panel title="Tracked" className="lg:col-span-7">
          {repos.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="eyebrow border-b text-left">
                    <th className="px-3 py-2 font-normal">Repository</th>
                    <th className="px-3 py-2 font-normal">Project</th>
                    <th className="px-3 py-2 font-normal">Links</th>
                    <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {repos.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{r.fullName}</td>
                      <td className="px-3 py-2"><ProjectTag project={r.projectId ? projects.get(r.projectId) : undefined} /></td>
                      <td className="px-3 py-2">
                        <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-teal hover:underline">
                          GitHub <ExternalLink className="size-3" />
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.fullName}`} onClick={() => openForm({ kind: "repo", id: r.id })}><Pencil /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No repositories tracked.</EmptyState>
          )}
        </Panel>
        <Panel title="Activity" badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />} className="lg:col-span-5">
          {hasData(feed) ? (
            <ul className="py-1">
              {feed.data.activity.map((a) => {
                const Icon = ACTIVITY_ICON[a.kind]
                return (
                  <li key={a.id} className="flex items-start gap-2.5 px-3 py-1.5 text-sm">
                    <Icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block">{a.summary}</span>
                      <span className="font-mono text-xs text-muted-foreground">{a.repo} · {a.actor} · {timeAgo(a.at)}</span>
                    </span>
                  </li>
                )
              })}
              {feed.data.activity.length === 0 && <EmptyState>No recent activity.</EmptyState>}
            </ul>
          ) : (
            <FeedFallback feed={feed} provider="github" what="repository activity" />
          )}
        </Panel>
      </div>
    </>
  )
}
