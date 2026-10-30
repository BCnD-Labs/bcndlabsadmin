import { Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectTag } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { projectHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ProjectStatus } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

export const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: "text-teal",
  planned: "text-muted-foreground",
  paused: "text-amber",
  done: "text-muted-foreground",
}

export function ProjectsPage() {
  const { projects, tasks, notes, drafts, repos } = useWorkspace()
  const openForm = useUi((s) => s.openForm)
  const order: ProjectStatus[] = ["active", "planned", "paused", "done"]
  const sorted = [...projects].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader
        title="Projects"
        badge={<SourceBadge status="local" />}
        description="Projects connect tasks, notes, repository links and drafts."
        actions={<Button onClick={() => openForm({ kind: "project" })}><Plus /> New project</Button>}
      />
      {sorted.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => {
            const open = tasks.filter((t) => t.projectId === p.id && t.status !== "done").length
            const counts = [
              [open, "open tasks"],
              [notes.filter((n) => n.projectId === p.id).length, "notes"],
              [drafts.filter((d) => d.projectId === p.id).length, "drafts"],
              [repos.filter((r) => r.projectId === p.id).length, "repos"],
            ] as const
            return (
              <li key={p.id}>
                <Link
                  to={projectHref(p.id)}
                  className="flex h-full flex-col gap-2 rounded-lg border bg-card p-3 outline-none hover:border-teal/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2">
                    <ProjectTag project={p} />
                    <span className="truncate font-bold">{p.name}</span>
                    <span className={cn("ml-auto text-xs capitalize", STATUS_STYLE[p.status])}>{p.status}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description || "No description."}</p>
                  <dl className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {counts.map(([n, label]) => (
                      <div key={label} className="flex gap-1">
                        <dt className="sr-only">{label}</dt>
                        <dd><b className="font-mono text-foreground">{n}</b> {label}</dd>
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
        <EmptyState action={<Button onClick={() => openForm({ kind: "project" })}>Create a project</Button>}>No projects yet.</EmptyState>
      )}
    </>
  )
}
