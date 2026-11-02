import { GridItem } from "@/components/common/workspace-grid"
import { FolderKanban, Plus, ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { ProjectStatusLabel } from "@/components/common/tags"
import { useNow } from "@/hooks/use-now"
import { toDateKey } from "@/lib/dates"
import { DEVELOPMENT, logHref, plannerHref, postsHref, projectHref, projectsHref } from "@/lib/routes"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

/** Local workspace counts; service activity keeps its own source labels in its panels. */
export function WorkspaceSummary() {
  const { tasks, drafts, repos } = useWorkspace()
  const today = toDateKey(useNow())
  const open = tasks.filter((t) => !t.done)
  const overdue = open.filter((t) => t.due && t.due < today).length
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Workspace summary">
      <Link to={plannerHref} className="bw-action-link hover:text-ink"><span className="font-semibold text-ink">{open.length}</span> open tasks{overdue > 0 && <span className="text-amber">· {overdue} overdue</span>}</Link>
      <Link to={DEVELOPMENT} className="bw-action-link hover:text-ink"><span className="font-semibold text-ink">{repos.length}</span> tracked repositories</Link>
      <Link to={postsHref + "?show=drafts"} className="bw-action-link hover:text-ink"><span className="font-semibold text-ink">{drafts.filter((d) => d.kind === "post").length}</span> post drafts</Link>
    </div>
  )
}

const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`

/** Existing project associations and today's real log, reachable from the organizational overview. */
export function WorkspaceContext() {
  const { projects, repos, drafts, journal } = useWorkspace()
  const openForm = useUi((s) => s.openForm)
  const today = toDateKey(useNow())
  const entry = journal.find((j) => j.id === today)
  const shown = projects.filter((p) => p.status !== "done").sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 2)
  return (
    <>
      <GridItem rows={1}>
      <Panel title="Projects" tool="projects" command="active" actions={<Button variant="quiet" size="icon-sm" aria-label="New project" onClick={() => openForm({ kind: "project" })}><Plus /></Button>}>
        {shown.length ? <ul className="grid divide-y divide-line-soft ">
          {shown.map((p) => <li key={p.id}><Link to={projectHref(p.id)} className="flex min-h-[72px] items-center gap-2.5 px-3.5 py-2 hover:bg-raised">
            <FolderKanban className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{p.name}</span><span className="block text-[11px] text-muted-foreground">{countLabel(repos.filter((r) => r.projectId === p.id).length, "repo")} · {countLabel(drafts.filter((d) => d.projectId === p.id).length, "draft")}</span></span>
            <ProjectStatusLabel status={p.status} /><ArrowUpRight className="size-3.5 shrink-0 text-faint" aria-hidden />
          </Link></li>)}
        </ul> : <p className="px-3.5 py-4 text-xs text-muted-foreground">Group related repositories and drafts into a project.</p>}
        <Link to={projectsHref} className="flex min-h-8 items-center justify-end border-t border-line-soft px-3.5 text-[11px] text-ink-2 hover:text-ink">All projects →</Link>
      </Panel>
      </GridItem>
      <GridItem rows={1}>
      <Panel title="Daily log" tool="log" command={today} bodyClassName="overflow-y-auto px-3.5 py-3">
        <p className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{entry?.text.trim() || "Keep a short record of what shipped, what you learned, and what comes next."}</p>
        <Link to={logHref(today)} className="mt-2 bw-action-link text-xs text-ink-2 hover:text-ink">{entry?.text.trim() ? "Continue today's log" : "Write today's log"}<ArrowUpRight className="size-3.5" aria-hidden /></Link>
      </Panel>
      </GridItem>
    </>
  )
}
