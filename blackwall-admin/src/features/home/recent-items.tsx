import { FileText, FolderKanban, History, Link2, NotebookText } from "lucide-react"
import { Link } from "react-router-dom"
import { EmptyState, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { DraftStatusTag, ProjectTag } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { draftHref, noteHref, projectHref } from "@/lib/routes"
import { useProjectMap, useWorkspace } from "@/stores/workspace"
import type { ReactNode } from "react"

interface Recent {
  id: string
  title: string
  kind: string
  href: string
  at: string
  icon: ReactNode
  meta?: ReactNode
}

export function RecentItems({ className }: { className?: string }) {
  const { projects, drafts, notes } = useWorkspace()
  const projectMap = useProjectMap()

  const items: Recent[] = [
    ...projects.map((p) => ({
      id: p.id,
      title: p.name,
      kind: "Project",
      href: projectHref(p.id),
      at: p.updatedAt,
      icon: <FolderKanban />,
      meta: <ProjectTag project={p} />,
    })),
    ...drafts.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind === "page" ? "Page draft" : "Post draft",
      href: draftHref(d.id),
      at: d.updatedAt,
      icon: <FileText />,
      meta: <DraftStatusTag status={d.status} />,
    })),
    ...notes.map((n) => ({
      id: n.id,
      title: n.title,
      kind: n.kind === "note" ? "Note" : n.kind === "link" ? "Link" : "Reference",
      href: noteHref(n),
      at: n.updatedAt,
      icon: n.kind === "link" ? <Link2 /> : <NotebookText />,
      meta: <ProjectTag project={n.projectId ? projectMap.get(n.projectId) : undefined} />,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 7)

  return (
    <Panel id="recent" title="Continue working" icon={<History />} badge={<SourceBadge status="local" />} className={className}>
      {items.length ? (
        <ul className="py-1">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                to={it.href}
                className="flex items-center gap-2.5 px-3 py-1.5 outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="text-muted-foreground [&_svg]:size-4">{it.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{it.title}</span>
                  <span className="text-xs text-muted-foreground">{it.kind} · {timeAgo(it.at)}</span>
                </span>
                <span className="hidden sm:block">{it.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>Projects, drafts and notes you touch will show up here.</EmptyState>
      )}
    </Panel>
  )
}
