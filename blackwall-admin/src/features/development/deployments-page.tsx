import { ExternalLink, Pencil, Plus, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { DataTable } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { ProjectTag } from "@/components/common/tags"
import type { RepoLink } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

function UrlCell({ url }: { url?: string }) {
  if (!url) return <span className="text-faint">—</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group/a inline-flex min-w-0 items-center gap-1.5 font-mono text-ink-2 hover:text-ink hover:underline">
      <span className="break-all">{url.replace(/^https?:\/\//, "")}</span>
      <ExternalLink className="size-3 shrink-0 text-faint group-hover/a:text-ink-2" aria-hidden />
    </a>
  )
}

export function DeploymentsPage() {
  const repos = useWorkspace((s) => s.repos)
  const projects = useProjectMap()
  const openForm = useUi((s) => s.openForm)
  return (
    <>
      <PageHeader title="Deployment links" subtitle="Production and preview links for your tracked repositories. Edit a repository to change them." />
      <Panel tool="deploy" command="links" meta={repos.length || undefined}>
        {repos.length ? (
          <DataTable<RepoLink>
            label="Deployment links"
            rows={repos}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "repo",
                header: "Repository",
                cell: (r) => (
                  <>
                    <span className="block font-mono break-all text-ink">{r.fullName}</span>
                    <span className="mt-1 block sm:hidden"><UrlCell url={r.productionUrl} /></span>
                  </>
                ),
              },
              { key: "project", header: "Project", optional: true, cell: (r) => <ProjectTag project={r.projectId ? projects.get(r.projectId) : undefined} /> },
              { key: "prod", header: "Production", optional: true, cell: (r) => <UrlCell url={r.productionUrl} /> },
              { key: "preview", header: "Preview", optional: true, cell: (r) => <UrlCell url={r.previewUrl} /> },
              {
                key: "edit",
                header: <span className="sr-only">Edit</span>,
                align: "right",
                className: "w-12",
                cell: (r) => (
                  <Button variant="quiet" size="icon-sm" aria-label={`Edit links for ${r.fullName}`} onClick={() => openForm({ kind: "repo", id: r.id })}><Pencil /></Button>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState icon={Rocket} title="No deployment links yet" action={<Button variant="outline" onClick={() => openForm({ kind: "repo" })}><Plus /> Track repository</Button>}>
            Track a repository, then add its production and preview URLs.
          </EmptyState>
        )}
      </Panel>
    </>
  )
}
