import { Pin, PinOff, Plus, Search, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState, PageHeader } from "@/components/common/panel"
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
            "size-6 rounded-full border-2 border-black outline-none focus-visible:ring-2 focus-visible:ring-ring",
            c.swatch,
            value === c.value && "shadow-brutal-sm ring-2 ring-black ring-offset-2 ring-offset-transparent scale-110",
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
    <li className={cn("group relative flex flex-col rounded-lg border-2 border-black p-2.5 shadow-brutal", color.card)} data-testid="sticky-note">
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
                className={cn("size-3.5 rounded-full border-2 border-black/70", c.swatch)}
              />
            ))}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={note.pinned ? "Unpin from Home" : "Pin to Home"}
          title={note.pinned ? "Unpin from Home" : "Pin to Home"}
          className={note.pinned ? "text-black" : "text-black/60"}
          onClick={() => togglePin(note.id)}
        >
          {note.pinned ? <PinOff /> : <Pin />}
        </Button>
        {!compact && (
          <Button
            variant="ghost"
            size="icon-xs"
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
        description="Quick notes. They save as you type; pinned ones also show on Home."
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="h-8 w-52 pl-7" />
          </div>
        }
      />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className={cn("mb-5 flex max-w-2xl flex-col gap-2 rounded-xl border-2 border-black p-3 shadow-brutal", noteColor(color).card)}
      >
        <label htmlFor="quick-note" className="sr-only">New note</label>
        <textarea
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
          placeholder="Take a note…  (⌘/Ctrl + Enter to add)"
          className="w-full resize-none bg-transparent text-sm font-medium outline-none placeholder:text-black/50"
        />
        <div className="flex items-center gap-2">
          <ColorPicker value={color} onChange={setColor} />
          <Button type="submit" size="sm" className="ml-auto" disabled={!quick.trim()}>
            <Plus /> Add note
          </Button>
        </div>
      </form>
      {list.length ? (
        <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Notes">
          {list.map((n) => (
            <StickyNote key={n.id} note={n} autoFocus={n.id === fresh} />
          ))}
        </ul>
      ) : (
        <EmptyState>{q ? "No notes match." : "No notes yet."}</EmptyState>
      )}
    </>
  )
}
