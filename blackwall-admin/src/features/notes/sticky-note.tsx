import { Layers, Link2, Pin, PinOff, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Note, NoteColor } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { modulesOf, tasksOfNote } from "@shared/links"
import { NOTE_COLORS, noteColor } from "./note-colors"
import { courseHref } from "@/lib/routes"
import { courseLabel } from "@/features/learning/learning-utils"
import { Link } from "react-router-dom"

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
  const course = useWorkspace((s) => (note.courseId ? s.courses.find((c) => c.id === note.courseId) : undefined))
  const allTasks = useWorkspace((s) => s.tasks)
  const openForm = useUi((s) => s.openForm)
  const linked = useMemo(() => tasksOfNote({ tasks: allTasks }, note.id), [allTasks, note.id])
  const modules = modulesOf(course, note)
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
      {(modules.length > 0 || linked.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-1" data-testid="note-links">
          {modules.map((m) => <span key={m.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/10 px-1.5 text-[11px] font-semibold text-black/80"><Layers className="size-2.5 shrink-0" aria-hidden /><span className="truncate">{m.title}</span></span>)}
          {linked.map((t) => <button key={t.id} type="button" onClick={() => openForm({ kind: "task", id: t.id })} title={`Open ${t.title}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/10 px-1.5 text-[11px] text-black/80 hover:bg-black/15"><Link2 className="size-2.5 shrink-0" aria-hidden /><span className="truncate">{t.title}</span></button>)}
        </div>
      )}
      <div className={cn("mt-1 flex items-center gap-1 text-xs text-black/75 [&_button:hover]:bg-black/10 [&_button:hover]:text-black", !focused && "opacity-80 group-hover:opacity-100")}>
        <span className="mr-auto flex min-w-0 items-center gap-1.5">
          {course && !compact && (
            <Link to={courseHref(course.id)} title={course.title} className="truncate rounded-full bg-black/10 px-1.5 font-semibold text-black/80 hover:bg-black/15">
              {courseLabel(course)}
            </Link>
          )}
          <span className="shrink-0">{timeAgo(note.updatedAt)}</span>
        </span>
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
        <Button variant="quiet" size="icon-sm" aria-label="Link to work or a module" title="Link to an assignment, task or module" className="text-black/60" onClick={() => openForm({ kind: "note", id: note.id })}><Link2 /></Button>
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
