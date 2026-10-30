import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Note, NoteKind } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { Field, OptionSelect, ProjectSelect } from "./fields"
import { FormFrame } from "./form-frame"

export const NOTE_KINDS: { value: NoteKind; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "reference", label: "Reference" },
  { value: "link", label: "Link" },
]

export function NoteForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Note>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.notes.find((n) => n.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  const [draft, setDraft] = useState({
    title: base?.title ?? "",
    body: base?.body ?? "",
    kind: base?.kind ?? ("note" as NoteKind),
    url: base?.url ?? "",
    pinned: base?.pinned ?? false,
    projectId: base?.projectId,
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  const save = () => {
    const values = {
      title: draft.title.trim(),
      body: draft.body,
      kind: draft.kind,
      url: draft.kind === "link" ? draft.url.trim() || undefined : undefined,
      pinned: draft.pinned,
      projectId: draft.projectId,
    }
    if (existing) {
      update("notes", existing.id, values)
      toast.success("Note saved")
    } else {
      create("notes", values)
      toast.success("Note created")
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? "Edit note" : "New note"}
      onSubmit={save}
      canSubmit={draft.title.trim().length > 0}
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
      <Field label="Title" htmlFor="note-title">
        <Input id="note-title" autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="note-kind">
          <OptionSelect id="note-kind" value={draft.kind} onChange={(kind) => set({ kind })} options={NOTE_KINDS} />
        </Field>
        <Field label="Project" htmlFor="note-project">
          <ProjectSelect id="note-project" value={draft.projectId} onChange={(projectId) => set({ projectId })} />
        </Field>
      </div>
      {draft.kind === "link" && (
        <Field label="URL" htmlFor="note-url">
          <Input id="note-url" type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={(e) => set({ url: e.target.value })} />
        </Field>
      )}
      <Field label="Body" htmlFor="note-body">
        <Textarea id="note-body" rows={6} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
      </Field>
      <div className="flex items-center gap-2">
        <Switch id="note-pinned" checked={draft.pinned} onCheckedChange={(pinned) => set({ pinned })} />
        <Label htmlFor="note-pinned">Pin to Home</Label>
      </div>
    </FormFrame>
  )
}
