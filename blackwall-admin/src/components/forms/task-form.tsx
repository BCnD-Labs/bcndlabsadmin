import { Star } from "lucide-react"
import { useState } from "react"
import { DocLinksField, cleanLinks } from "@/components/common/doc-links"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { kindInfo, learningType } from "@/features/learning/learning-utils"
import type { LearningItemType, Task } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { CourseSelect, Field, OptionSelect } from "./fields"
import { FormFrame } from "./form-frame"

export function TaskForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Task>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.tasks.find((t) => t.id === id))
  const hasCourses = useWorkspace((s) => s.courses.length > 0)
  const courses = useWorkspace((s) => s.courses)
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  const [draft, setDraft] = useState({
    title: base?.title ?? "",
    details: base?.details ?? "",
    due: base?.due ?? "",
    time: base?.time ?? "",
    courseId: base?.courseId,
    learningType: base?.learningType ?? ("assignment" as LearningItemType),
    starred: base?.starred ?? false,
    done: base?.done ?? false,
    links: base?.links ?? [],
    score: base?.score != null ? String(base.score) : "",
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  const course = courses.find((c) => c.id === draft.courseId)
  const kind = kindInfo(course?.kind)
  const type = learningType(draft.learningType, kind.value)
  // A practice test (certification) can carry its score.
  const scored = kind.value === "certification" && draft.learningType === "exam"
  const score = draft.score.trim() === "" ? undefined : Number(draft.score)
  const scoreBad = score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)
  // Coursework reads as what it is: "New assignment", "Exam updated".
  const noun = draft.courseId ? type.label : "Task"

  const save = () => {
    const values = {
      title: draft.title.trim(),
      details: draft.details.trim() || undefined,
      due: draft.due || undefined,
      time: (draft.due && draft.time) || undefined,
      courseId: draft.courseId,
      learningType: draft.courseId ? draft.learningType : undefined,
      starred: draft.starred,
      done: draft.done,
      links: cleanLinks(draft.links),
      score: draft.courseId && scored ? score : undefined,
    }
    if (existing) {
      const completedAt = values.done ? (existing.completedAt ?? new Date().toISOString()) : undefined
      update("tasks", existing.id, { ...values, completedAt })
      toast.success(`${noun} updated`)
    } else {
      create("tasks", { ...values, completedAt: values.done ? new Date().toISOString() : undefined })
      toast.success(`${noun} added`)
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? `Edit ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`}
      onSubmit={save}
      canSubmit={draft.title.trim().length > 0 && !(scored && scoreBad)}
      onDelete={
        existing
          ? () => {
              remove("tasks", existing.id)
              toast(`${noun} deleted`)
              onDone()
            }
          : undefined
      }
    >
      <Field label="Title" htmlFor="task-title">
        <Input id="task-title" autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="What needs doing?" />
      </Field>
      {(hasCourses || draft.courseId) && (
        <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <Field label="Learning" htmlFor="task-course">
            <CourseSelect
              id="task-course"
              value={draft.courseId}
              onChange={(courseId) => {
                // Keep the type when the new kind has it; otherwise use that kind's first type.
                const next = kindInfo(courses.find((c) => c.id === courseId)?.kind)
                set({ courseId, learningType: next.types.some((t) => t.value === draft.learningType) ? draft.learningType : next.types[0].value })
              }}
            />
          </Field>
          {draft.courseId && (
            <Field label="Type" htmlFor="task-type">
              <OptionSelect id="task-type" value={draft.learningType} onChange={(learningType) => set({ learningType })} options={kind.types.map((t) => ({ value: t.value, label: t.label }))} />
            </Field>
          )}
        </div>
      )}
      <Field label={draft.courseId ? "Notes" : "Details"} htmlFor="task-details">
        <Textarea
          id="task-details"
          rows={draft.courseId ? 4 : 3}
          value={draft.details}
          onChange={(e) => set({ details: e.target.value })}
          placeholder={draft.courseId ? "Optional: requirements, links, what to study…" : "Optional"}
        />
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={draft.courseId ? type.dateLabel : "Due date"} htmlFor="task-due" className="w-44">
          <Input id="task-due" type="date" value={draft.due} onChange={(e) => set({ due: e.target.value })} />
        </Field>
        {draft.due && (
          <Field label="Time" htmlFor="task-time" className="w-32">
            <Input id="task-time" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
        )}
        {draft.courseId && scored && (
          <Field label="Score %" htmlFor="task-score" className="w-28" error={scoreBad ? "0 to 100." : undefined}>
            <Input id="task-score" inputMode="decimal" value={draft.score} onChange={(e) => set({ score: e.target.value })} placeholder="—" />
          </Field>
        )}
        <div className="flex items-center gap-2 pb-1.5">
          <Switch id="task-star" checked={draft.starred} onCheckedChange={(starred) => set({ starred })} />
          <Label htmlFor="task-star" className="inline-flex items-center gap-1 text-xs font-normal">
            <Star className="size-3.5 text-amber" aria-hidden /> Starred
          </Label>
        </div>
        {existing && (
          <div className="flex items-center gap-2 pb-1.5">
            <Switch id="task-done" checked={draft.done} onCheckedChange={(done) => set({ done })} />
            <Label htmlFor="task-done" className="text-xs font-normal">Done</Label>
          </div>
        )}
      </div>
      <Field label="Linked documents" htmlFor="task-links" hint="Notes, specs or files that live elsewhere. They open in their own app.">
        <DocLinksField value={draft.links} onChange={(links) => set({ links })} />
      </Field>
    </FormFrame>
  )
}
