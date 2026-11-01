import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { projectHref } from "@/lib/routes"
import type { Project, ProjectColor, ProjectStatus } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { Field, OptionSelect } from "./fields"
import { FormFrame } from "./form-frame"

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "planned", label: "Planned" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
]
const COLORS: { value: ProjectColor; label: string }[] = [
  { value: "teal", label: "Teal" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
  { value: "slate", label: "Slate" },
]

export function ProjectForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Project>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.projects.find((p) => p.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const navigate = useNavigate()
  const base = existing ?? defaults
  const [draft, setDraft] = useState({
    name: base?.name ?? "",
    code: base?.code ?? "",
    status: base?.status ?? ("active" as ProjectStatus),
    color: base?.color ?? ("teal" as ProjectColor),
    description: base?.description ?? "",
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))
  const autoCode = draft.name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase()

  const save = () => {
    const values = {
      name: draft.name.trim(),
      code: (draft.code.trim() || autoCode || "PRJ").toUpperCase().slice(0, 5),
      status: draft.status,
      color: draft.color,
      description: draft.description.trim(),
    }
    if (existing) {
      update("projects", existing.id, values)
      toast.success("Project updated")
      onDone()
    } else {
      const p = create("projects", values)
      toast.success("Project created")
      onDone()
      navigate(projectHref(p.id))
    }
  }

  return (
    <FormFrame
      title={existing ? "Edit project" : "New project"}
      onSubmit={save}
      canSubmit={draft.name.trim().length > 0}
      onDelete={
        existing
          ? () => {
              remove("projects", existing.id)
              toast("Project deleted; linked records were kept and unlinked")
              onDone()
              navigate("/work/projects")
            }
          : undefined
      }
    >
      <div className="grid grid-cols-[1fr_6rem] gap-x-4">
        <Field label="Name" htmlFor="project-name">
          <Input id="project-name" autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Code" htmlFor="project-code">
          <Input id="project-code" className="font-mono uppercase" maxLength={5} placeholder={autoCode || "KEY"} value={draft.code} onChange={(e) => set({ code: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Status" htmlFor="project-status">
          <OptionSelect id="project-status" value={draft.status} onChange={(status) => set({ status })} options={PROJECT_STATUSES} />
        </Field>
        <Field label="Colour" htmlFor="project-color">
          <OptionSelect id="project-color" value={draft.color} onChange={(color) => set({ color })} options={COLORS} />
        </Field>
      </div>
      <Field label="Description" htmlFor="project-description">
        <Textarea id="project-description" rows={3} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
    </FormFrame>
  )
}
