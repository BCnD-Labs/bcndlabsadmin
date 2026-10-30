import { ArrowLeft, Info, Save, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { DRAFT_STATUS_LABEL } from "@/components/common/tags"
import { Field, OptionSelect, ProjectSelect } from "@/components/forms/fields"
import { slugify } from "@/lib/ids"
import { timeAgo } from "@/lib/dates"
import type { Draft, DraftKind, DraftStatus } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"

const STATUSES = (Object.keys(DRAFT_STATUS_LABEL) as DraftStatus[]).map((value) => ({ value, label: DRAFT_STATUS_LABEL[value] }))
const KINDS: { value: DraftKind; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "page", label: "Page" },
]

type Editable = Pick<Draft, "title" | "slug" | "kind" | "status" | "excerpt" | "body" | "projectId">
const pick = (d: Draft): Editable => ({
  title: d.title,
  slug: d.slug,
  kind: d.kind,
  status: d.status,
  excerpt: d.excerpt,
  body: d.body,
  projectId: d.projectId,
})

export function DraftEditor() {
  const { id = "" } = useParams()
  const saved = useWorkspace((s) => s.drafts.find((d) => d.id === id))
  return saved ? (
    <Editor key={id} draft={saved} />
  ) : (
    <EmptyState action={<Button asChild variant="outline"><Link to="/content/drafts">Back to drafts</Link></Button>}>
      This draft doesn't exist (it may have been deleted).
    </EmptyState>
  )
}

function Editor({ draft }: { draft: Draft }) {
  const update = useWorkspace((s) => s.update)
  const remove = useWorkspace((s) => s.remove)
  const navigate = useNavigate()
  const [value, setValue] = useState<Editable>(() => pick(draft))
  const [slugTouched, setSlugTouched] = useState(draft.slug !== slugify(draft.title))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(pick(draft))

  const set = (patch: Partial<Editable>) =>
    setValue((v) => {
      const next = { ...v, ...patch }
      if (patch.title !== undefined && !slugTouched) next.slug = slugify(patch.title) || "untitled"
      return next
    })

  const save = useCallback(() => {
    if (!value.title.trim()) return toast.error("A title is required")
    update("drafts", draft.id, { ...value, title: value.title.trim(), slug: slugify(value.slug) || "untitled" })
    toast.success("Draft saved locally")
  }, [draft.id, update, value])

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [save])

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [dirty])
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  const words = value.body.trim() ? value.body.trim().split(/\s+/).length : 0

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/content/drafts"><ArrowLeft /> Drafts</Link>
        </Button>
        <SourceBadge status="local" />
        <span className="text-xs text-muted-foreground" aria-live="polite" data-testid="save-state">
          {dirty ? "Unsaved changes" : `Saved ${timeAgo(draft.updatedAt)}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-red-text">Delete this draft?</span>
              <Button size="sm" variant="destructive" onClick={() => { remove("drafts", draft.id); toast("Draft deleted"); navigate("/content/drafts") }}>Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="text-red-text" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>
          )}
          <Button onClick={save} disabled={!dirty}>
            <Save /> Save <kbd className="ml-1 hidden font-mono text-[0.68rem] opacity-70 sm:inline">⌘S</kbd>
          </Button>
        </div>
      </div>

      {blocker.state === "blocked" && (
        <Alert className="mb-3 border-amber/50">
          <AlertDescription className="flex flex-wrap items-center gap-2 text-foreground">
            You have unsaved changes.
            <Button size="sm" onClick={() => { save(); blocker.proceed() }}>Save and leave</Button>
            <Button size="sm" variant="ghost" className="text-red-text" onClick={() => blocker.proceed()}>Discard</Button>
            <Button size="sm" variant="ghost" onClick={() => blocker.reset()}>Stay</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3">
          <label className="sr-only" htmlFor="draft-title">Title</label>
          <Input
            id="draft-title"
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            className="h-11 border-transparent bg-transparent px-1 text-xl font-bold md:text-xl dark:bg-transparent"
            placeholder="Title"
          />
          <Field label="Excerpt" htmlFor="draft-excerpt">
            <Textarea id="draft-excerpt" rows={2} value={value.excerpt} onChange={(e) => set({ excerpt: e.target.value })} placeholder="One or two sentences for listings and previews" />
          </Field>
          <Field label="Body (Markdown)" htmlFor="draft-body" hint={`${words} words`}>
            <Textarea
              id="draft-body"
              value={value.body}
              onChange={(e) => set({ body: e.target.value })}
              className="min-h-[50vh] font-mono text-sm leading-relaxed"
              placeholder="Write…"
            />
          </Field>
        </div>
        <aside className="flex flex-col gap-3 self-start rounded-lg border bg-card p-3">
          <Field label="Type" htmlFor="draft-kind">
            <OptionSelect id="draft-kind" value={value.kind} onChange={(kind) => set({ kind })} options={KINDS} />
          </Field>
          <Field label="Status" htmlFor="draft-status">
            <OptionSelect id="draft-status" value={value.status} onChange={(status) => set({ status })} options={STATUSES} />
          </Field>
          <Field label="Slug" htmlFor="draft-slug">
            <Input id="draft-slug" className="font-mono text-xs" value={value.slug} onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value }) }} />
          </Field>
          <Field label="Project" htmlFor="draft-project">
            <ProjectSelect id="draft-project" value={value.projectId} onChange={(projectId) => set({ projectId })} />
          </Field>
          <div className="flex gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <p>
              Saved to this browser only. Publishing to bcndlabs.com is <SourceBadge status="not-connected" className="align-middle" /> in this phase.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
