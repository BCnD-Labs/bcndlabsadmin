import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { CircleDot, ExternalLink, FileText, FolderX, GitBranch, GitPullRequest, Pencil, Plus } from "lucide-react"
import type { ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { DraftStatusTag, PROJECT_HEX, ProjectStatusLabel, ProjectTile, StatusMarker } from "@/components/common/tags"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { ACTIVITY_ICON } from "@/features/home/dev-attention"
import { Sparkline, lastDays } from "@/features/home/overview-panels"
import { shortAgo, timeAgo } from "@/lib/dates"
import { draftHref, projectsHref } from "@/lib/routes"
import type { Project, RepoLink } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { useProjectActivity, type ProjectActivity } from "./project-activity"

function RepoRow({ repo, act, live, color }: { repo: RepoLink; act: ProjectActivity; live: boolean; color: string }) {
  const openForm = useUi((s) => s.openForm)
  const same = (r: string) => r.toLowerCase() === repo.fullName.toLowerCase()
  const summary = act.summaries.find((s) => same(s.repo))
  const failures = act.failures.filter((f) => same(f.repo)).length
  const prs = act.prs.filter((p) => same(p.repo)).length
  const [owner, name] = repo.fullName.split("/")
  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-line-soft px-3.5 py-2 last:border-b-0 hover:bg-raised">
      <GitBranch className="size-4 shrink-0 text-faint" aria-hidden />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => openForm({ kind: "repo", id: repo.id })} className="block max-w-full truncate text-left font-mono text-[13px] font-semibold text-ink hover:underline" title={`Edit ${repo.fullName}`}>
          {name ?? repo.fullName}
        </button>
        <span className="block truncate text-[11px] text-muted-foreground">
          {summary?.description || owner}
          {summary?.pushedAt && <> · pushed {shortAgo(summary.pushedAt)} ago</>}
        </span>
      </div>
      {live && (
        <>
          <span className="hidden sm:block"><Sparkline values={lastDays(summary?.commitsByDay, 14)} color={color} /></span>
          <span className="hidden w-24 shrink-0 items-center gap-1.5 text-[11px] text-ink-2 md:inline-flex"><StatusMarker tone={failures ? "error" : "ok"} /> {failures ? `${failures} failed` : "Passing"}</span>
          <span className="inline-flex w-8 shrink-0 items-center gap-1 text-[11px] text-muted-foreground" title="Open pull requests"><GitPullRequest className="size-3" aria-hidden /> {prs}</span>
        </>
      )}
      <Button size="icon-sm" variant="quiet" asChild>
        <a href={repo.url} target="_blank" rel="noreferrer" aria-label={`Open ${repo.fullName} on GitHub`}><ExternalLink /></a>
      </Button>
    </li>
  )
}

function Overview({ project, act, live, drafts }: { project: Project; act: ProjectActivity; live: boolean; drafts: number }) {
  // Only what the panels beside it don't already show (status is in the header; PRs and CI are on each repo row).
  const rows: [string, ReactNode][] = [
    ...(live ? ([["Open issues", act.issues.length]] as [string, ReactNode][]) : []),
    ["Drafts", drafts],
    ["Created", timeAgo(project.createdAt)],
    ["Updated", timeAgo(project.updatedAt)],
  ]
  return (
    <Panel category="projects" title="Overview" tool="project" command="info" bodyClassName="px-3.5 py-3">
      {live && act.linked.length > 0 && (
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-line-soft pb-3.5">
          <div>
            <p className="font-heading text-3xl leading-none font-bold text-ink tabular-nums lg:text-2xl">{act.commits14}</p>
            <p className="mt-1 text-xs text-muted-foreground">commits · 14 days</p>
          </div>
          <Sparkline values={act.spark} color={PROJECT_HEX[project.color]} />
        </div>
      )}
      <dl className="grid gap-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1 text-[13px]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {project.description && <p className="mt-2.5 border-t border-line-soft pt-2.5 text-xs leading-relaxed whitespace-pre-line text-ink-2">{project.description}</p>}
    </Panel>
  )
}

export function ProjectDetail() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const { projects, drafts, repos } = useWorkspace()
  const project = projects.find((p) => p.id === id)
  const { live, byProject } = useProjectActivity(project ? [project] : [], repos)

  if (!project) {
    return (
      <>
        <PageHeader title="Project not found" back={{ to: projectsHref, label: "Projects" }} />
        <Panel tool="projects" command={`open ${id}`}>
          <EmptyState icon={FolderX} title="This project doesn't exist" action={<Button variant="outline" asChild><Link to={projectsHref}>Back to projects</Link></Button>}>
            It may have been deleted.
          </EmptyState>
        </Panel>
      </>
    )
  }

  const act = byProject.get(project.id)!
  const pDrafts = drafts.filter((d) => d.projectId === id)
  const newDraft = () => navigate(draftHref(createDraft({ projectId: id }).id))
  const newRepo = () => openForm({ kind: "repo", defaults: { projectId: id } })
  const color = PROJECT_HEX[project.color]

  return (
    <>
      <PageHeader
        back={{ to: projectsHref, label: "Projects" }}
        title={project.name}
        badge={<><ProjectTile project={project} size={28} /><ProjectStatusLabel status={project.status} /></>}
        subtitle={project.description ? project.description.split("\n")[0] : undefined}
        actions={<Button variant="ghost" onClick={() => openForm({ kind: "project", id })}><Pencil /> Edit</Button>}
      />
      <WorkspaceGrid>
        {/* Left: the lists, at their natural height. Right: the summary and drafts stacked. */}
        <GridItem span={3} className="gap-[var(--bw-grid-gap)] [&>.bw-panel]:flex-none">
          <Panel
            category="development"
            title="Repositories"
            tool="project"
            command="repos"
            meta={act.linked.length || undefined}
            actions={<Button size="icon-sm" variant="quiet" aria-label="Link a repository" title="Link a repository" onClick={newRepo}><Plus /></Button>}
          >
            {act.linked.length ? (
              <ul>{act.linked.map((r) => <RepoRow key={r.id} repo={r} act={act} live={live} color={color} />)}</ul>
            ) : (
              <EmptyState icon={GitBranch} title="No repositories linked" action={<Button variant="outline" onClick={newRepo}><Plus /> Link a repository</Button>}>
                Linked repositories bring their commits, pull requests and CI status here.
              </EmptyState>
            )}
          </Panel>
          <Panel category="development" title="Recent activity" tool="project" command="log" meta={live ? act.activity.length || undefined : undefined}>
            {live && act.activity.length ? (
              <ul>
                {act.activity.slice(0, 8).map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind]
                  const body = <><Icon className="size-3.5 shrink-0 text-faint" aria-hidden /><span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.summary}</span><span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">{a.repo.split("/")[1]}</span><span className="w-14 shrink-0 text-right text-[11px] text-faint">{shortAgo(a.at)}</span></>
                  return (
                    <li key={a.id} className="border-b border-line-soft last:border-b-0">
                      {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2.5 px-3.5 py-1.5 hover:bg-raised">{body}</a> : <div className="flex min-h-10 items-center gap-2.5 px-3.5 py-1.5">{body}</div>}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState icon={CircleDot} title={live ? "No recent activity" : act.linked.length ? "Connect GitHub to see activity" : "Link a repository to see activity"} />
            )}
          </Panel>
        </GridItem>
        <GridItem className="gap-[var(--bw-grid-gap)] [&>.bw-panel]:flex-none">
          <Overview project={project} act={act} live={live} drafts={pDrafts.length} />
          <Panel
            category="website"
            title="Drafts"
            tool="project"
            command="drafts"
            meta={pDrafts.length || undefined}
            actions={<Button size="icon-sm" variant="quiet" aria-label="New draft" title="New draft" onClick={newDraft}><Plus /></Button>}
          >
            {pDrafts.length ? (
              <ul>
                {pDrafts.map((d) => (
                  <li key={d.id} className="border-b border-line-soft last:border-b-0">
                    <Link to={draftHref(d.id)} className="flex min-h-10 min-w-0 items-center gap-2.5 px-3.5 py-1.5 hover:bg-raised">
                      <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{d.title}</span>
                      <DraftStatusTag status={d.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={FileText} title="No drafts linked" action={<Button variant="outline" onClick={newDraft}><Plus /> New draft</Button>} />
            )}
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
