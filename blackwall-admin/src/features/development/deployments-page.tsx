import { ExternalLink, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectTag } from "@/components/common/tags"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

function UrlCell({ url }: { url?: string }) {
  if (!url) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-teal hover:underline">
      {url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
    </a>
  )
}

export function DeploymentsPage() {
  const repos = useWorkspace((s) => s.repos)
  const projects = useProjectMap()
  const openForm = useUi((s) => s.openForm)
  return (
    <>
      <PageHeader
        title="Deployment links"
        badge={<SourceBadge status="local" />}
        description="Production and preview URLs saved on repository links. Deployment status is not connected."
      />
      <div className="overflow-x-auto rounded-lg border bg-card">
        {repos.length ? (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="eyebrow border-b text-left">
                <th className="px-3 py-2 font-normal">Repository</th>
                <th className="px-3 py-2 font-normal">Project</th>
                <th className="px-3 py-2 font-normal">Production</th>
                <th className="px-3 py-2 font-normal">Preview</th>
                <th className="px-3 py-2"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {repos.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.fullName}</td>
                  <td className="px-3 py-2"><ProjectTag project={r.projectId ? projects.get(r.projectId) : undefined} /></td>
                  <td className="px-3 py-2"><UrlCell url={r.productionUrl} /></td>
                  <td className="px-3 py-2"><UrlCell url={r.previewUrl} /></td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit links for ${r.fullName}`} onClick={() => openForm({ kind: "repo", id: r.id })}><Pencil /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>Track a repository to add deployment links.</EmptyState>
        )}
      </div>
    </>
  )
}
