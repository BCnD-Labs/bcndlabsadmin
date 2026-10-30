import { Pin, PinOff, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectTag } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

export function PinnedNotes({ className }: { className?: string }) {
  const notes = useWorkspace((s) => s.notes)
  const togglePin = useWorkspace((s) => s.togglePin)
  const openForm = useUi((s) => s.openForm)
  const projects = useProjectMap()
  const pinned = notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <Panel
      id="pinned-notes"
      title="Pinned notes"
      icon={<Pin />}
      badge={<SourceBadge status="local" />}
      className={className}
      bodyClassName="flex flex-col"
      actions={
        <>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/knowledge/notes">All notes</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => openForm({ kind: "note", defaults: { pinned: true } })}>
            <Plus /> Note
          </Button>
        </>
      }
    >
      {pinned.length ? (
        <ul className="grid content-start gap-2 overflow-y-auto p-2 md:min-h-0 md:flex-1 md:basis-0" aria-label="Pinned notes">
          {pinned.map((n) => (
            <li key={n.id} className="group relative rounded-md border border-border/70 bg-recessed/60 hover:border-teal/50" data-testid="pinned-note">
              <button
                type="button"
                onClick={() => openForm({ kind: "note", id: n.id })}
                className="block w-full rounded-md p-2.5 pr-9 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block truncate text-sm font-bold">{n.title}</span>
                {n.body && (
                  <span className="mt-0.5 line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">{n.body}</span>
                )}
                <span className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <ProjectTag project={n.projectId ? projects.get(n.projectId) : undefined} />
                  <span className="capitalize">{n.kind}</span>
                  <span className="ml-auto">{timeAgo(n.updatedAt)}</span>
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-amber"
                onClick={() => togglePin(n.id)}
                aria-label={`Unpin "${n.title}"`}
                title="Unpin"
              >
                <PinOff />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>Pin notes you want close at hand.</EmptyState>
      )}
    </Panel>
  )
}
