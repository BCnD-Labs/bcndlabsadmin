import { ArrowLeft, CalendarDays, ExternalLink, FileText, GitBranch, ListChecks, NotebookText, Pencil, Plus } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { DraftStatusTag, ProjectTag } from "@/components/common/tags"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { EventRow, byTime } from "@/features/home/agenda-panel"
import { timeAgo, todayKey } from "@/lib/dates"
import { draftHref, noteHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { STATUS_STYLE } from "./projects-page"
import { TaskRow } from "./task-row"
import { compareTasks } from "./task-utils"

export function ProjectDetail() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const { projects, tasks, notes, drafts, repos, events } = useWorkspace()
  const project = projects.find((p) => p.id === id)

  if (!project) {
    return (
      <EmptyState action={<Button asChild variant="outline"><Link to="/work/projects">Back to projects</Link></Button>}>
        This project doesn't exist (it may have been deleted).
      </EmptyState>
    )
  }

  const pTasks = tasks.filter((t) => t.projectId === id).sort(compareTasks)
  const pNotes = notes.filter((n) => n.projectId === id)
  const pDrafts = drafts.filter((d) => d.projectId === id)
  const pRepos = repos.filter((r) => r.projectId === id)
  const pEvents = events.filter((e) => e.projectId === id && e.date >= todayKey()).sort(byTime)

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
        <Link to="/work/projects"><ArrowLeft /> Projects</Link>
      </Button>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectTag project={project} />
            <h1 className="text-xl font-bold">{project.name}</h1>
            <span className={cn("text-sm capitalize", STATUS_STYLE[project.status])}>{project.status}</span>
            <SourceBadge status="local" />
          </div>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{project.description}</p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={() => openForm({ kind: "project", id })}>
          <Pencil /> Edit
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <Panel
          title="Tasks"
          icon={<ListChecks />}
          className="lg:col-span-7"
          actions={<Button size="sm" variant="outline" onClick={() => openForm({ kind: "task", defaults: { projectId: id } })}><Plus /> Task</Button>}
        >
          {pTasks.length ? (
            <ul>{pTasks.map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}</ul>
          ) : (
            <EmptyState>No tasks linked.</EmptyState>
          )}
        </Panel>
        <Panel
          title="Upcoming events"
          icon={<CalendarDays />}
          className="lg:col-span-5"
          actions={<Button size="sm" variant="outline" onClick={() => openForm({ kind: "event", defaults: { projectId: id } })}><Plus /> Event</Button>}
          bodyClassName="p-1.5"
        >
          {pEvents.length ? <ul>{pEvents.map((e) => <EventRow key={e.id} event={e} showDate />)}</ul> : <EmptyState>No upcoming events.</EmptyState>}
        </Panel>
        <Panel
          title="Notes"
          icon={<NotebookText />}
          className="lg:col-span-4"
          actions={<Button size="sm" variant="outline" onClick={() => openForm({ kind: "note", defaults: { projectId: id } })}><Plus /> Note</Button>}
        >
          {pNotes.length ? (
            <ul className="py-1">
              {pNotes.map((n) => (
                <li key={n.id}>
                  <Link to={noteHref(n)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40">
                    <span className="min-w-0 flex-1 truncate">{n.title}</span>
                    <span className="text-xs text-muted-foreground capitalize">{n.kind}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No notes linked.</EmptyState>
          )}
        </Panel>
        <Panel
          title="Drafts"
          icon={<FileText />}
          className="lg:col-span-4"
          actions={<Button size="sm" variant="outline" onClick={() => navigate(draftHref(createDraft({ projectId: id }).id))}><Plus /> Draft</Button>}
        >
          {pDrafts.length ? (
            <ul className="py-1">
              {pDrafts.map((d) => (
                <li key={d.id}>
                  <Link to={draftHref(d.id)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40">
                    <span className="min-w-0 flex-1 truncate">{d.title}</span>
                    <DraftStatusTag status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No drafts linked.</EmptyState>
          )}
        </Panel>
        <Panel
          title="Repositories"
          icon={<GitBranch />}
          className="lg:col-span-4"
          actions={<Button size="sm" variant="outline" onClick={() => openForm({ kind: "repo", defaults: { projectId: id } })}><Plus /> Repo</Button>}
        >
          {pRepos.length ? (
            <ul className="py-1">
              {pRepos.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <button type="button" className="min-w-0 flex-1 truncate text-left font-mono text-xs hover:underline" onClick={() => openForm({ kind: "repo", id: r.id })}>
                    {r.fullName}
                  </button>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-teal" aria-label={`Open ${r.fullName} on GitHub`}>
                    <ExternalLink className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No repositories linked.</EmptyState>
          )}
        </Panel>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Last updated {timeAgo(project.updatedAt)}.</p>
    </>
  )
}
