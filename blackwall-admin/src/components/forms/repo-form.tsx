import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { RepoLink } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { Field, ProjectSelect } from "./fields"
import { FormFrame } from "./form-frame"

/** Accepts `owner/name` or a GitHub URL. */
function parseRepo(input: string): { fullName: string; url: string } | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/$/, "")
  const m = s.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)$/i)
  if (!m) return null
  const fullName = `${m[1]}/${m[2]}`
  return { fullName, url: `https://github.com/${fullName}` }
}

export function RepoForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<RepoLink>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.repos.find((r) => r.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  const [draft, setDraft] = useState({
    repo: base?.fullName ?? "",
    productionUrl: base?.productionUrl ?? "",
    previewUrl: base?.previewUrl ?? "",
    notes: base?.notes ?? "",
    projectId: base?.projectId,
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))
  const parsed = parseRepo(draft.repo)

  const save = () => {
    if (!parsed) return
    const values = {
      ...parsed,
      productionUrl: draft.productionUrl.trim() || undefined,
      previewUrl: draft.previewUrl.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      projectId: draft.projectId,
    }
    if (existing) {
      update("repos", existing.id, values)
      toast.success("Repository link updated")
    } else {
      create("repos", values)
      toast.success("Repository link added")
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? "Edit repository link" : "Track a repository"}
      onSubmit={save}
      canSubmit={!!parsed}
      onDelete={
        existing
          ? () => {
              remove("repos", existing.id)
              toast("Repository link removed")
              onDone()
            }
          : undefined
      }
    >
      <Field
        label="Repository"
        htmlFor="repo-name"
        hint={draft.repo && !parsed ? <span className="text-red-text">Use owner/name or a github.com URL.</span> : "Stored locally. Activity needs the GitHub integration."}
      >
        <Input id="repo-name" autoFocus className="font-mono" placeholder="owner/name" value={draft.repo} aria-invalid={!!draft.repo && !parsed} onChange={(e) => set({ repo: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Production URL" htmlFor="repo-prod">
          <Input id="repo-prod" type="url" placeholder="https://" value={draft.productionUrl} onChange={(e) => set({ productionUrl: e.target.value })} />
        </Field>
        <Field label="Preview URL" htmlFor="repo-preview">
          <Input id="repo-preview" type="url" placeholder="https://" value={draft.previewUrl} onChange={(e) => set({ previewUrl: e.target.value })} />
        </Field>
      </div>
      <Field label="Project" htmlFor="repo-project">
        <ProjectSelect id="repo-project" value={draft.projectId} onChange={(projectId) => set({ projectId })} />
      </Field>
      <Field label="Notes" htmlFor="repo-notes">
        <Textarea id="repo-notes" rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </FormFrame>
  )
}
