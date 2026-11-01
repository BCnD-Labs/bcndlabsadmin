import { FolderKanban, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { ProjectStatusLabel, ProjectTag } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { projectHref } from "@/lib/routes"
import type { ProjectStatus } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

export function ProjectsPage() {
  const { projects, drafts, repos } = useWorkspace()
  const openForm = useUi((s) => s.openForm)
  const order: ProjectStatus[] = ["active", "planned", "paused", "done"]
  const sorted = [...projects].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name))
  const newProject = () => openForm({ kind: "project" })

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="What you're building, with its repositories and content drafts."
        actions={<Button size="lg" onClick={newProject}><Plus /> New project</Button>}
      />
      {sorted.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => {
            const counts = [
              [repos.filter((r) => r.projectId === p.id).length, "repos"],
              [drafts.filter((d) => d.projectId === p.id).length, "drafts"],
            ] as const
            return (
              <li key={p.id} className="flex">
                <Link
                  to={projectHref(p.id)}
                  className="bw-panel flex flex-1 flex-col gap-2.5 p-3.5 transition-colors duration-150 hover:border-ledge-hi hover:bg-raised"
                >
                  <div className="flex items-center gap-2">
                    <ProjectTag project={p} />
                    <span className="ml-auto"><ProjectStatusLabel status={p.status} /></span>
                  </div>
                  <span className="font-heading text-base leading-snug font-bold">{p.name}</span>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description || "No description."}</p>
                  <dl className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2.5 text-[11px] text-muted-foreground">
                    {counts.map(([n, label]) => (
                      <div key={label} className="flex gap-1">
                        <dt className="sr-only">{label}</dt>
                        <dd><span className="font-heading font-bold text-ink tabular-nums">{n}</span> {label}</dd>
                      </div>
                    ))}
                    <div className="ml-auto">Updated {timeAgo(p.updatedAt)}</div>
                  </dl>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <Panel tool="projects" command="ls">
          <EmptyState icon={FolderKanban} title="No projects yet" action={<Button variant="outline" onClick={newProject}><Plus /> Create a project</Button>}>
            A project groups the repositories and drafts that belong together.
          </EmptyState>
        </Panel>
      )}
    </>
  )
}
