import { useState } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ColorPicker } from "@/features/notes/notes-page"
import type { Note, NoteColor } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { CourseSelect, Field } from "./fields"
import { FormFrame } from "./form-frame"

/** Quick note dialog (header "New" menu, search). The Notes board edits inline. */
export function NoteForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Note>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.notes.find((n) => n.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  const [text, setText] = useState(base?.text ?? "")
  const [color, setColor] = useState<NoteColor>(base?.color ?? "amber")
  const [pinned, setPinned] = useState(base?.pinned ?? false)
  const [courseId, setCourseId] = useState(base?.courseId)
  const hasCourses = useWorkspace((s) => s.courses.length > 0)

  const save = () => {
    if (existing) {
      update("notes", existing.id, { text, color, pinned, courseId })
      toast.success("Note saved")
    } else {
      create("notes", { text, color, pinned, courseId })
      toast.success("Note added")
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? "Edit note" : "New note"}
      onSubmit={save}
      canSubmit={text.trim().length > 0}
      onDelete={
        existing
          ? () => {
              remove("notes", existing.id)
              toast("Note deleted")
              onDone()
            }
          : undefined
      }
    >
      <Field label="Note" htmlFor="note-text">
        <Textarea id="note-text" autoFocus rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Jot something down…" />
      </Field>
      {(hasCourses || courseId) && (
        <Field label="Course" htmlFor="note-course">
          <CourseSelect id="note-course" value={courseId} onChange={setCourseId} />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <ColorPicker value={color} onChange={setColor} />
        <div className="ml-auto flex items-center gap-2">
          <Switch id="note-pinned" checked={pinned} onCheckedChange={setPinned} />
          <Label htmlFor="note-pinned" className="text-xs font-normal">Pin to Home</Label>
        </div>
      </div>
    </FormFrame>
  )
}
