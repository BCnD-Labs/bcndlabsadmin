import { Pin, PinOff, Plus, StickyNote as StickyNoteIcon, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { SearchField } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Note, NoteColor } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { NOTE_COLORS, noteColor } from "./note-colors"

export function ColorPicker({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Note colour" className="flex items-center gap-1.5">
      {NOTE_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={value === c.value}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(c.value)}
          className={cn(
            "size-6 rounded-[6px] border-r-2 border-b-2 border-black/30 transition-transform duration-150",
            c.swatch,
            value === c.value && "ring-2 ring-ink-2 ring-offset-2 ring-offset-panel",
          )}
        />
      ))}
    </div>
  )
}

/** A sticky note that edits in place and saves as you type. */
export function StickyNote({ note, autoFocus, compact }: { note: Note; autoFocus?: boolean; compact?: boolean }) {
  const update = useWorkspace((s) => s.update)
  const remove = useWorkspace((s) => s.remove)
  const togglePin = useWorkspace((s) => s.togglePin)
  const [text, setText] = useState(note.text)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const color = noteColor(note.color)

  // Keep in sync with edits made elsewhere (e.g. the dialog) when not focused.
  const [synced, setSynced] = useState(note.text)
  if (!focused && note.text !== synced) {
    setSynced(note.text)
    setText(note.text)
  }

  useEffect(() => {
    if (text === note.text) return
    const t = window.setTimeout(() => update("notes", note.id, { text }), 400)
    return () => window.clearTimeout(t)
  }, [text, note.id, note.text, update])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  // Grow with content.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, compact ? 160 : 320)}px`
  }, [text, compact])

  return (
    <li className={cn("group relative flex flex-col rounded-[10px] border-r-4 border-b-4 border-black/30 px-3 pt-2.5 pb-2", color.card)} data-testid="sticky-note">
      <label htmlFor={`note-${note.id}`} className="sr-only">Note</label>
      <textarea
        id={`note-${note.id}`}
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          if (text !== note.text) update("notes", note.id, { text })
          if (!text.trim()) {
            remove("notes", note.id)
            toast("Empty note removed")
          }
        }}
        placeholder="Write…"
        rows={compact ? 2 : 3}
        className="w-full resize-none bg-transparent text-sm leading-relaxed font-medium outline-none placeholder:text-black/45"
      />
      <div className={cn("mt-1 flex items-center gap-1 text-xs text-black/65 [&_button:hover]:bg-black/10 [&_button:hover]:text-black", !focused && "opacity-80 group-hover:opacity-100")}>
        <span className="mr-auto">{timeAgo(note.updatedAt)}</span>
        {!compact && (
          <span className="hidden gap-1 group-focus-within:flex group-hover:flex">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={`Make ${c.label.toLowerCase()}`}
                onClick={() => update("notes", note.id, { color: c.value })}
                className={cn("size-3.5 rounded-[3px] border border-black/40", c.swatch)}
              />
            ))}
          </span>
        )}
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label={note.pinned ? "Unpin from Home" : "Pin to Home"}
          title={note.pinned ? "Unpin from Home" : "Pin to Home"}
          className={note.pinned ? "text-black" : "text-black/60"}
          onClick={() => togglePin(note.id)}
        >
          {note.pinned ? <PinOff /> : <Pin />}
        </Button>
        {!compact && (
          <Button
            variant="quiet"
            size="icon-sm"
            aria-label="Delete note"
            className="text-black/60"
            onClick={() => {
              remove("notes", note.id)
              toast("Note deleted", {
                action: { label: "Undo", onClick: () => useWorkspace.setState((s) => ({ notes: [note, ...s.notes] })) },
              })
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  )
}

export function NotesPage() {
  const notes = useWorkspace((s) => s.notes)
  const create = useWorkspace((s) => s.create)
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState("")
  const [quick, setQuick] = useState("")
  const [color, setColor] = useState<NoteColor>("amber")
  const [fresh] = useState<string | null>(params.get("id"))

  useEffect(() => {
    if (params.get("id")) setParams({}, { replace: true })
  }, [params, setParams])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return notes
      .filter((n) => !needle || n.text.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  }, [notes, q])

  const add = () => {
    const text = quick.trim()
    if (!text) return
    create("notes", { text, color, pinned: false })
    setQuick("")
  }

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle="Quick notes. They save as you type; pinned ones also show on Home."
        actions={<SearchField value={q} onChange={setQ} label="Search notes" />}
      />
      <Panel tool="notes" command="new" className="mb-4 max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex flex-col gap-3 px-3.5 py-3"
        >
          <label htmlFor="quick-note" className="sr-only">New note</label>
          <Textarea
            id="quick-note"
            rows={2}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                add()
              }
            }}
            placeholder="Take a note…"
          />
          <div className="flex flex-wrap items-center gap-3">
            <ColorPicker value={color} onChange={setColor} />
            <span className="ml-auto hidden text-[11px] text-faint sm:inline">⌘/Ctrl + Enter</span>
            <Button type="submit" disabled={!quick.trim()} className="ml-auto sm:ml-0">
              <Plus /> Add note
            </Button>
          </div>
        </form>
      </Panel>
      {list.length ? (
        <ul className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Notes">
          {list.map((n) => (
            <StickyNote key={n.id} note={n} autoFocus={n.id === fresh} />
          ))}
        </ul>
      ) : (
        <Panel tool="notes" command="ls" className="max-w-2xl">
          <EmptyState icon={StickyNoteIcon} title={q ? "No notes match" : "No notes yet"}>
            {q ? "Try a different search." : "Write one above. Pin it to see it on Home."}
          </EmptyState>
        </Panel>
      )}
    </>
  )
}
