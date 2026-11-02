import { ExternalLink, FileText, FolderX, GitBranch, Pencil, Plus } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ListRow } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { DraftStatusTag, ProjectStatusLabel, ProjectTag } from "@/components/common/tags"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { timeAgo } from "@/lib/dates"
import { draftHref, projectsHref } from "@/lib/routes"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

export function ProjectDetail() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const { projects, drafts, repos } = useWorkspace()
  const project = projects.find((p) => p.id === id)

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

  const pDrafts = drafts.filter((d) => d.projectId === id)
  const pRepos = repos.filter((r) => r.projectId === id)
  const newDraft = () => navigate(draftHref(createDraft({ projectId: id }).id))
  const newRepo = () => openForm({ kind: "repo", defaults: { projectId: id } })

  return (
    <>
      <PageHeader
        back={{ to: projectsHref, label: "Projects" }}
        title={project.name}
        badge={<><ProjectTag project={project} /><ProjectStatusLabel status={project.status} /></>}
        subtitle={<>{project.description || "No description."} <span className="text-faint">· Updated {timeAgo(project.updatedAt)}</span></>}
        actions={<Button variant="ghost" onClick={() => openForm({ kind: "project", id })}><Pencil /> Edit</Button>}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          tool="repos"
          command="ls"
          meta={pRepos.length || undefined}
          actions={<Button size="icon-sm" variant="quiet" aria-label="Link a repository" title="Link a repository" onClick={newRepo}><Plus /></Button>}
        >
          {pRepos.length ? (
            <ul>
              {pRepos.map((r) => (
                <ListRow key={r.id}>
                  <GitBranch className="size-3.5 shrink-0 text-faint" aria-hidden />
                  <button type="button" className="min-w-0 flex-1 truncate text-left font-mono text-xs text-ink hover:underline" onClick={() => openForm({ kind: "repo", id: r.id })}>
                    {r.fullName}
                  </button>
                  <Button size="icon-sm" variant="quiet" asChild>
                    <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.fullName} on GitHub`}><ExternalLink /></a>
                  </Button>
                </ListRow>
              ))}
            </ul>
          ) : (
            <EmptyState icon={GitBranch} title="No repositories linked" action={<Button variant="outline" onClick={newRepo}><Plus /> Link a repository</Button>} />
          )}
        </Panel>
        <Panel
          tool="drafts"
          command="ls"
          meta={pDrafts.length || undefined}
          actions={<Button size="icon-sm" variant="quiet" aria-label="New draft" title="New draft" onClick={newDraft}><Plus /></Button>}
        >
          {pDrafts.length ? (
            <ul>
              {pDrafts.map((d) => (
                <ListRow key={d.id} className="p-0">
                  <Link to={draftHref(d.id)} className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 px-3.5 py-1.5">
                    <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{d.title}</span>
                    <DraftStatusTag status={d.status} />
                  </Link>
                </ListRow>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileText} title="No drafts linked" action={<Button variant="outline" onClick={newDraft}><Plus /> New draft</Button>} />
          )}
        </Panel>
      </div>
    </>
  )
}
