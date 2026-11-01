import { Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { StickyNote } from "@/features/notes/notes-page"
import { useWorkspace } from "@/stores/workspace"

export function PinnedNotes({ className }: { className?: string }) {
  const notes = useWorkspace((s) => s.notes)
  const create = useWorkspace((s) => s.create)
  const pinned = notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const recent = pinned.length ? [] : [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)
  const shown = pinned.length ? pinned : recent

  return (
    <Panel
      id="pinned-notes"
      tool="notes" command={pinned.length ? "pinned" : "recent"}
      className={className}
      bodyClassName="flex flex-col"
      actions={
        <>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/notes">All notes</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const n = create("notes", { text: "", color: "amber", pinned: true })
              // Focus the new sticky in place; it's removed again if left empty.
              requestAnimationFrame(() => document.getElementById(`note-${n.id}`)?.focus())
            }}
          >
            <Plus /> Note
          </Button>
        </>
      }
    >
      {shown.length ? (
        <ul className="grid max-h-[24rem] content-start gap-2 overflow-y-auto p-2" aria-label="Pinned notes">
          {shown.map((n) => (
            <StickyNote key={n.id} note={n} compact />
          ))}
        </ul>
      ) : (
        <EmptyState title="No notes yet">Pinned notes show up here.</EmptyState>
      )}
      {!pinned.length && recent.length > 0 && (
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">Showing recent notes. Pin one to keep it here.</p>
      )}
    </Panel>
  )
}
