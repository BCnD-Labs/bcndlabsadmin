import { CategoryIcon } from "@/components/common/category-icon"
import { useMemo, useState } from "react"
import { Pin, PinOff, Plus, Search, StickyNote, X } from "lucide-react"
import { toast } from "sonner"
import { DocLinksMenu } from "@/components/common/doc-links"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { CourseTag } from "@/features/learning/coursework"
import { noteColor, noteTitle } from "@/features/notes/note-colors"
import { shortAgo } from "@/lib/dates"
import type { Note } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
function SearchBox({ value, onChange, label, onClose }: { value: string; onChange: (v: string) => void; label: string; onClose: () => void }) {
  return (
    <label className="mx-3 mt-2.5 flex h-8 shrink-0 items-center gap-2 rounded-[var(--bw-control-radius)] border border-rim bg-well px-2.5">
      <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none md:text-[13px]"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="text-faint hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </label>
  )
}

/* ------------------------------------------------------------------ notes */

export function PlannerNotes() {
  const notes = useWorkspace((s) => s.notes)
  const openForm = useUi((s) => s.openForm)
  const [q, setQ] = useState("")
  const [searching, setSearching] = useState(false)

  const { pinned, others } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = notes.filter((n) => !needle || n.text.toLowerCase().includes(needle)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return { pinned: list.filter((n) => n.pinned), others: list.filter((n) => !n.pinned) }
  }, [notes, q])
  const closeSearch = () => {
    setQ("")
    setSearching(false)
  }

  return (
    <div id="notes" className="flex min-h-0 min-w-0 scroll-mt-28 flex-col">
      <div className="bw-panel-heading flex shrink-0 items-center gap-2">
        <CategoryIcon category="notes" /><h2 className="bw-panel-title">Notes <span className="text-faint">· {notes.length}</span></h2>
        <span className="ml-auto" />
        <Button variant="quiet" size="icon-sm" aria-label="Search notes" aria-pressed={searching} onClick={() => (searching ? closeSearch() : setSearching(true))}>
          <Search />
        </Button>
        <Button variant="quiet" size="icon-sm" aria-label="New note" onClick={() => openForm({ kind: "note" })}>
          <Plus />
        </Button>
      </div>
      {searching && <SearchBox value={q} onChange={setQ} label="Search notes" onClose={closeSearch} />}
      <div className="min-h-0 overflow-y-auto">
        {pinned.length + others.length === 0 ? (
          <EmptyState icon={StickyNote} title={q ? "No notes match" : "No notes yet"} className="py-8" action={!q && <Button variant="outline" size="sm" onClick={() => openForm({ kind: "note" })}><Plus /> Add a note</Button>}>
            {q ? "Try a different search." : "Pinned notes also show on Home."}
          </EmptyState>
        ) : (
          <>
            {pinned.length > 0 && <NoteGroup label="Pinned" notes={pinned} />}
            {others.length > 0 && <NoteGroup label={pinned.length ? "Others" : "All notes"} notes={others} />}
          </>
        )}
      </div>
    </div>
  )
}

function NoteGroup({ label, notes }: { label: string; notes: Note[] }) {
  return (
    <section aria-label={label} className="mb-1.5 last:mb-0">
      <h3 className="bw-label px-3.5 pt-1.5 pb-1">
        {label} <span className="text-faint">· {notes.length}</span>
      </h3>
      <ul>
        {notes.map((n) => (
          <NoteLine key={n.id} note={n} />
        ))}
      </ul>
    </section>
  )
}

/** One note as a line: colour dot, first line, age. Click to open it. */
function NoteLine({ note }: { note: Note }) {
  const openForm = useUi((s) => s.openForm)
  const togglePin = useWorkspace((s) => s.togglePin)
  const course = useWorkspace((s) => (note.courseId ? s.courses.find((c) => c.id === note.courseId) : undefined))
  const title = noteTitle(note.text)
  const more = note.text.trim().includes("\n")
  return (
    <li className="group relative" data-testid="planner-note">
      <button
        type="button"
        onClick={() => openForm({ kind: "note", id: note.id })}
        className={cn("flex min-h-[39px] w-full items-center gap-2.5 border-b border-line-soft py-2 pl-3.5 text-left text-sm hover:bg-raised md:pl-6", note.links?.length ? "pr-[4.5rem]" : "pr-9")}
        title={note.text.trim().slice(0, 300)}
      >
        <span className={cn("size-2 shrink-0 rounded-full", noteColor(note.color).swatch)} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
          {title}
          {more && <span className="text-faint"> …</span>}
        </span>
        {course && <CourseTag course={course} asLink={false} className="hidden h-4 px-1.5 text-[10px] xl:inline-flex" />}
        <span className="shrink-0 text-[10px] text-faint tabular-nums">{shortAgo(note.updatedAt)}</span>
      </button>
      <DocLinksMenu links={note.links} className="absolute top-2 right-9" />
      <button
        type="button"
        aria-label={note.pinned ? `Unpin "${title}"` : `Pin "${title}"`}
        title={note.pinned ? "Unpin from Home" : "Pin to Home"}
        onClick={() => {
          togglePin(note.id)
          toast(note.pinned ? "Unpinned" : "Pinned to Home")
        }}
        className={cn(
          "absolute top-2 right-2 flex size-6 items-center justify-center rounded-[6px] text-faint hover:bg-ledge hover:text-ink",
          note.pinned ? "text-ink-2" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        {note.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
    </li>
  )
}

