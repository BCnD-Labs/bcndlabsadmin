import { Star } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Task } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { Field } from "./fields"
import { FormFrame } from "./form-frame"

export function TaskForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Task>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.tasks.find((t) => t.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  const [draft, setDraft] = useState({
    title: base?.title ?? "",
    details: base?.details ?? "",
    due: base?.due ?? "",
    starred: base?.starred ?? false,
    done: base?.done ?? false,
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  const save = () => {
    const values = {
      title: draft.title.trim(),
      details: draft.details.trim() || undefined,
      due: draft.due || undefined,
      starred: draft.starred,
      done: draft.done,
    }
    if (existing) {
      const completedAt = values.done ? (existing.completedAt ?? new Date().toISOString()) : undefined
      update("tasks", existing.id, { ...values, completedAt })
      toast.success("Task updated")
    } else {
      create("tasks", { ...values, completedAt: values.done ? new Date().toISOString() : undefined })
      toast.success("Task added")
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
        <Input id="task-title" autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="What needs doing?" />
      </Field>
      <Field label="Details" htmlFor="task-details">
        <Textarea id="task-details" rows={3} value={draft.details} onChange={(e) => set({ details: e.target.value })} placeholder="Optional" />
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Due date" htmlFor="task-due" className="w-44">
          <Input id="task-due" type="date" value={draft.due} onChange={(e) => set({ due: e.target.value })} />
        </Field>
        <div className="flex items-center gap-2 pb-1.5">
          <Switch id="task-star" checked={draft.starred} onCheckedChange={(starred) => set({ starred })} />
          <Label htmlFor="task-star" className="inline-flex items-center gap-1">
            <Star className="size-3.5 text-amber" aria-hidden /> Starred
          </Label>
        </div>
        {existing && (
          <div className="flex items-center gap-2 pb-1.5">
            <Switch id="task-done" checked={draft.done} onCheckedChange={(done) => set({ done })} />
            <Label htmlFor="task-done">Done</Label>
          </div>
        )}
      </div>
    </FormFrame>
  )
}
