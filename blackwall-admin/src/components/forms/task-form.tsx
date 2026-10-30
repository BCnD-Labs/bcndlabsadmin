import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PRIORITY_LABEL } from "@/components/common/tags"
import type { Priority, Task, TaskStatus } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { Field, OptionSelect, ProjectSelect } from "./fields"
import { FormFrame } from "./form-frame"

const PRIORITIES = (["urgent", "high", "medium", "low"] as Priority[]).map((value) => ({
  value,
  label: PRIORITY_LABEL[value],
}))
const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
]

export function TaskForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Task>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.tasks.find((t) => t.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const [draft, setDraft] = useState({
    title: existing?.title ?? defaults?.title ?? "",
    notes: existing?.notes ?? defaults?.notes ?? "",
    priority: existing?.priority ?? defaults?.priority ?? ("medium" as Priority),
    status: existing?.status ?? defaults?.status ?? ("todo" as TaskStatus),
    due: existing?.due ?? defaults?.due ?? "",
    projectId: existing?.projectId ?? defaults?.projectId,
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  const save = () => {
    const values = {
      title: draft.title.trim(),
      notes: draft.notes.trim() || undefined,
      priority: draft.priority,
      status: draft.status,
      due: draft.due || undefined,
      projectId: draft.projectId,
    }
    if (existing) {
      const completedAt =
        values.status === "done" ? (existing.completedAt ?? new Date().toISOString()) : undefined
      update("tasks", existing.id, { ...values, completedAt })
      toast.success("Task updated")
    } else {
      create("tasks", {
        ...values,
        completedAt: values.status === "done" ? new Date().toISOString() : undefined,
      })
      toast.success("Task created")
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? "Edit task" : "New task"}
      onSubmit={save}
      canSubmit={draft.title.trim().length > 0}
      onDelete={
        existing
          ? () => {
              remove("tasks", existing.id)
              toast("Task deleted")
              onDone()
            }
          : undefined
      }
    >
      <Field label="Title" htmlFor="task-title">
        <Input id="task-title" autoFocus required value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="What needs doing?" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority" htmlFor="task-priority">
          <OptionSelect id="task-priority" value={draft.priority} onChange={(priority) => set({ priority })} options={PRIORITIES} />
        </Field>
        <Field label="Status" htmlFor="task-status">
          <OptionSelect id="task-status" value={draft.status} onChange={(status) => set({ status })} options={STATUSES} />
        </Field>
        <Field label="Due date" htmlFor="task-due">
          <Input id="task-due" type="date" value={draft.due} onChange={(e) => set({ due: e.target.value })} />
        </Field>
        <Field label="Project" htmlFor="task-project">
          <ProjectSelect id="task-project" value={draft.projectId} onChange={(projectId) => set({ projectId })} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="task-notes">
        <Textarea id="task-notes" rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </FormFrame>
  )
}
