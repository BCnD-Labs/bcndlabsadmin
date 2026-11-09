import { DocLinksField, cleanLinks } from "@/components/common/doc-links"
import { useState } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ColorPicker } from "@/features/notes/sticky-note"
import type { Note, NoteColor } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { CourseSelect, Field } from "./fields"
import { TopicChips } from "./topics-field"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setNoteTaskLinks, tasksOfNote } from "@shared/links"
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
  const [links, setLinks] = useState(base?.links ?? [])
  const hasCourses = useWorkspace((s) => s.courses.length > 0)
  const courses = useWorkspace((s) => s.courses)
  const allTasks = useWorkspace((s) => s.tasks)
  const course = courses.find((c) => c.id === courseId)
  const [topicIds, setTopicIds] = useState<string[]>(base?.topicIds ?? [])
  const [taskIds, setTaskIds] = useState<string[]>(() => (existing ? tasksOfNote({ tasks: allTasks }, existing.id).map((t) => t.id) : []))
  // Work from the chosen course first, then everything else, so "which assignment is this for?" is one pick.
  const pickable = [...allTasks].filter((t) => t.kind !== "event" && !taskIds.includes(t.id)).sort((a, b) => Number(b.courseId === courseId) - Number(a.courseId === courseId) || Number(a.done) - Number(b.done)).slice(0, 150)

  const save = () => {
    const modules = courseId && topicIds.length ? topicIds.filter((id) => course?.topics?.some((t) => t.id === id)) : []
    const values = { text, color, pinned, courseId, topicIds: modules.length ? modules : undefined, links: cleanLinks(links) }
    let id = existing?.id
    if (existing) {
      update("notes", existing.id, values)
      toast.success("Note saved")
    } else {
      id = create("notes", values).id
      toast.success("Note added")
    }
    // The links live on the tasks, so changing them edits those tasks in one step.
    if (id && (existing || taskIds.length)) useWorkspace.setState((s) => setNoteTaskLinks({ tasks: s.tasks }, id!, taskIds, new Date().toISOString()))
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
      {!!course?.topics?.length && (
        <Field label="Module" htmlFor="note-modules" hint="Which module this note belongs to.">
          <TopicChips topics={course.topics} value={topicIds} onChange={setTopicIds} />
        </Field>
      )}
      <Field label="Linked work" htmlFor="note-work" hint="Assignments, quizzes, exams or tasks this note is for. They show the note too.">
        <div className="grid gap-2">
          {taskIds.length > 0 && <ul className="flex flex-wrap gap-1.5">{taskIds.map((id) => { const t = allTasks.find((x) => x.id === id); return <li key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-ink-2/10 py-0.5 pr-0.5 pl-2.5 text-[12px] text-ink-2"><span className="truncate">{t?.title ?? "Deleted task"}</span><Button type="button" variant="quiet" size="icon-sm" className="size-5" aria-label={`Unlink ${t?.title ?? "task"}`} onClick={() => setTaskIds(taskIds.filter((x) => x !== id))}><X className="size-3" /></Button></li> })}</ul>}
          <select aria-label="Link a task" className="h-9 w-full rounded-md border border-line bg-well px-2 text-[13px] text-ink" value="" onChange={(e) => e.target.value && setTaskIds([...taskIds, e.target.value])}>
            <option value="">+ Link an assignment or task…</option>
            {pickable.map((t) => <option key={t.id} value={t.id}>{t.title.slice(0, 80)}{t.done ? " (done)" : ""}</option>)}
          </select>
        </div>
      </Field>
      <Field label="Linked documents" htmlFor="note-links">
        <DocLinksField value={links} onChange={setLinks} />
      </Field>
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
