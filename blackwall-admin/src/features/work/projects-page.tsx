import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { CircleDot, FileText, FolderKanban, GitBranch, GitPullRequest, Plus } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { StatStrip } from "@/components/common/stat-strip"
import { PROJECT_HEX, ProjectStatusLabel, ProjectTile, StatusMarker } from "@/components/common/tags"
import { Sparkline } from "@/features/home/overview-panels"
import { shortAgo, timeAgo } from "@/lib/dates"
import { projectHref } from "@/lib/routes"
import type { Project, ProjectStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { useProjectActivity, type ProjectActivity } from "./project-activity"

const ORDER: ProjectStatus[] = ["active", "planned", "paused", "done"]
const STATUS_LABEL: Record<ProjectStatus, string> = { active: "Active", planned: "Planned", paused: "Paused", done: "Done" }
type Filter = ProjectStatus | "all"

function ProjectCard({ project, act, drafts, live }: { project: Project; act?: ProjectActivity; drafts: number; live: boolean }) {
  const failing = act?.failures.length ?? 0
  return (
    <li className="flex min-w-0">
      <Link to={projectHref(project.id)} className="bw-panel flex flex-1 flex-col gap-3 p-4 transition-colors duration-150 hover:bg-raised" data-testid="project-card">
        <div className="flex items-start gap-3">
          <ProjectTile project={project} />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-heading text-[15px] leading-snug font-bold text-ink">{project.name}</span>
            <ProjectStatusLabel status={project.status} />
          </div>
        </div>
        <p className="line-clamp-2 min-h-[2lh] text-xs leading-relaxed text-muted-foreground">{project.description || "No description."}</p>
        {live && act && act.linked.length > 0 ? (
          <div className="mt-auto flex items-end justify-between gap-3">
            <Sparkline values={act.spark} color={PROJECT_HEX[project.color]} />
            <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              <span className="font-semibold text-ink">{act.commits14}</span> commits · 14d
              {act.lastPush && <span className="block text-[11px] text-faint">pushed {shortAgo(act.lastPush)} ago</span>}
            </span>
          </div>
        ) : (
          <p className="mt-auto text-[11px] text-faint">{act?.linked.length ? "Connect GitHub to see activity" : "No repositories linked"}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Repositories"><GitBranch className="size-3" aria-hidden /> {act?.linked.length ?? 0}</span>
          <span className="inline-flex items-center gap-1" title="Drafts"><FileText className="size-3" aria-hidden /> {drafts}</span>
          {live && <span className="inline-flex items-center gap-1" title="Open pull requests"><GitPullRequest className="size-3" aria-hidden /> {act?.prs.length ?? 0}</span>}
          {live && <span className="inline-flex items-center gap-1" title="Open issues"><CircleDot className="size-3" aria-hidden /> {act?.issues.length ?? 0}</span>}
          {live && failing > 0 && <span className="inline-flex items-center gap-1 text-red-light"><StatusMarker tone="error" /> {failing} failed</span>}
          <span className="ml-auto">Updated {timeAgo(project.updatedAt)}</span>
        </div>
      </Link>
    </li>
  )
}

export function ProjectsPage() {
  const { projects, drafts, repos } = useWorkspace()
  const openForm = useUi((s) => s.openForm)
  const [filter, setFilter] = useState<Filter>("all")
  const { live, byProject } = useProjectActivity(projects, repos)
  const counts = Object.fromEntries(ORDER.map((s) => [s, projects.filter((p) => p.status === s).length])) as Record<ProjectStatus, number>
  const effective: Filter = filter !== "all" && !counts[filter] ? "all" : filter
  const sorted = projects
    .filter((p) => effective === "all" || p.status === effective)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name))
  const newProject = () => openForm({ kind: "project" })
  const all = [...byProject.values()]
  const commits = all.reduce((n, a) => n + a.commits14, 0)
  const prs = all.reduce((n, a) => n + a.prs.length, 0)
  const failing = all.reduce((n, a) => n + a.failures.length, 0)

  return (
    <>
      <PageHeader title="Projects" actions={<Button onClick={newProject}><Plus /> New project</Button>} />
      {projects.length ? (
        <WorkspaceGrid>
          <GridItem span="full">
            <StatStrip
              items={[
                { label: "Active", value: counts.active, sub: counts.planned ? `${counts.planned} planned` : undefined },
                { label: "Commits · 14 days", value: live ? commits : "—", sub: live ? "across linked repos" : "needs GitHub" },
                { label: "Open pull requests", value: live ? prs : "—" },
                { label: "Failed runs", value: live ? failing : "—", tone: live && failing ? "error" : undefined },
              ]}
            />
          </GridItem>
          <GridItem span="full">
            <section aria-label="Projects" className="bw-grid-region grid grid-cols-[minmax(0,1fr)] gap-3">
              <SegmentedTabs
                label="Show projects"
                className="w-full overflow-x-auto [scrollbar-width:none] sm:w-auto sm:self-start sm:justify-self-start"
                tabClassName="flex-none px-2.5 sm:px-3"
                value={effective}
                onChange={setFilter}
                tabs={[{ value: "all" as Filter, label: "All", count: projects.length }, ...ORDER.filter((s) => counts[s]).map((s) => ({ value: s as Filter, label: STATUS_LABEL[s], count: counts[s] }))]}
              />
              <ul className={cn("bw-card-grid")}>
                {sorted.map((p) => (
                  <ProjectCard key={p.id} project={p} act={byProject.get(p.id)} drafts={drafts.filter((d) => d.projectId === p.id).length} live={live} />
                ))}
              </ul>
            </section>
          </GridItem>
        </WorkspaceGrid>
      ) : (
        <WorkspaceGrid><GridItem span={2}><Panel category="projects" title="Projects" tool="projects" command="ls">
          <EmptyState roomy icon={FolderKanban} title="No projects yet" action={<Button variant="outline" onClick={newProject}><Plus /> Create a project</Button>}>
            A project groups the repositories and drafts that belong together, with their GitHub activity in one place.
          </EmptyState>
        </Panel></GridItem></WorkspaceGrid>
      )}
    </>
  )
}
