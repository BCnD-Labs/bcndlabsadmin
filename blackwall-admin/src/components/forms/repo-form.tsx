import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { RepoLink } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { Field, OptionSelect, ProjectSelect } from "./fields"
import { useConnections } from "@/services/connector"
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
    connectionId: base?.connectionId ?? "auto",
  })
  const githubAccounts = useConnections((st) => st.list.filter((c) => c.provider === "github"))
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
      connectionId: draft.connectionId === "auto" ? undefined : draft.connectionId,
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
        hint="Saved in your shared workspace. Activity needs a GitHub connection."
        error={draft.repo && !parsed ? "Use owner/name or a github.com URL." : undefined}
      >
        <Input id="repo-name" autoFocus className="font-mono" placeholder="owner/name" value={draft.repo} onChange={(e) => set({ repo: e.target.value })} />
      </Field>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Production URL" htmlFor="repo-prod">
          <Input id="repo-prod" type="url" placeholder="https://" value={draft.productionUrl} onChange={(e) => set({ productionUrl: e.target.value })} />
        </Field>
        <Field label="Preview URL" htmlFor="repo-preview">
          <Input id="repo-preview" type="url" placeholder="https://" value={draft.previewUrl} onChange={(e) => set({ previewUrl: e.target.value })} />
        </Field>
      </div>
      {githubAccounts.length > 1 && (
        <Field label="GitHub account" htmlFor="repo-account" hint="Which connection reads this repository. Automatic uses the first working one.">
          <OptionSelect
            id="repo-account"
            value={draft.connectionId}
            onChange={(connectionId) => set({ connectionId })}
            options={[{ value: "auto", label: "Automatic" }, ...githubAccounts.map((c) => ({ value: c.id, label: `${c.label}${c.account ? ` · ${c.account}` : ""}${c.status === "ok" ? "" : " (needs attention)"}` }))]}
          />
        </Field>
      )}
      <Field label="Project" htmlFor="repo-project">
        <ProjectSelect id="repo-project" value={draft.projectId} onChange={(projectId) => set({ projectId })} />
      </Field>
      <Field label="Notes" htmlFor="repo-notes">
        <Textarea id="repo-notes" rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </FormFrame>
  )
}
