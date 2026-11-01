import { FileX, Save, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { DRAFT_STATUS_LABEL, DraftStatusTag } from "@/components/common/tags"
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
    <>
      <PageHeader title="Draft not found" back={{ to: "/content/drafts", label: "Drafts" }} />
      <Panel tool="draft" command={`open ${id}`}>
        <EmptyState icon={FileX} title="This draft doesn't exist" action={<Button asChild variant="outline"><Link to="/content/drafts">Back to drafts</Link></Button>}>
          It may have been deleted.
        </EmptyState>
      </Panel>
    </>
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
      <PageHeader
        back={{ to: "/content/drafts", label: "Drafts" }}
        title={value.title.trim() || "Untitled"}
        badge={<DraftStatusTag status={value.status} />}
        subtitle={
          <span aria-live="polite" data-testid="save-state">
            {dirty ? "Unsaved changes" : `Saved in this browser ${timeAgo(draft.updatedAt)}`}
          </span>
        }
        actions={
          confirmDelete ? (
            <>
              <span className="text-[11px] text-ink-2">Delete this draft?</span>
              <Button size="lg" variant="destructive" onClick={() => { remove("drafts", draft.id); toast("Draft deleted"); navigate("/content/drafts") }}>Delete</Button>
              <Button size="lg" variant="quiet" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </>
          ) : (
            <>
              <Button size="lg" variant="quiet" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>
              <Button size="lg" onClick={save} disabled={!dirty}>
                <Save /> Save <kbd className="ml-1 hidden font-mono text-[10px] opacity-80 sm:inline">⌘S</kbd>
              </Button>
            </>
          )
        }
      />

      {blocker.state === "blocked" && (
        <div role="alert" className="bw-panel mb-3 flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-xs">
          <span className="size-1.5 rounded-[1.5px] bg-amber" aria-hidden />
          <span className="mr-auto text-ink">You have unsaved changes.</span>
          <Button onClick={() => { save(); blocker.proceed() }}>Save and leave</Button>
          <Button variant="outline" onClick={() => blocker.proceed()}>Discard</Button>
          <Button variant="quiet" onClick={() => blocker.reset()}>Stay</Button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel tool="draft" command="edit" bodyClassName="flex flex-col gap-3.5 px-3.5 py-3.5">
          <Field label="Title" htmlFor="draft-title">
            <Input
              id="draft-title"
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
              className="h-10 font-heading text-lg font-bold md:text-lg"
              placeholder="Title"
            />
          </Field>
          <Field label="Excerpt" htmlFor="draft-excerpt" hint="One or two sentences for listings and previews.">
            <Textarea id="draft-excerpt" rows={2} value={value.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
          </Field>
          <Field label="Body (Markdown)" htmlFor="draft-body" hint={`${words} ${words === 1 ? "word" : "words"}`}>
            <Textarea
              id="draft-body"
              value={value.body}
              onChange={(e) => set({ body: e.target.value })}
              className="min-h-[50vh] font-mono leading-relaxed"
              placeholder="Write…"
            />
          </Field>
        </Panel>
        <Panel tool="draft" command="meta" className="self-start" bodyClassName="flex flex-col gap-3.5 px-3.5 py-3.5">
          <Field label="Type" htmlFor="draft-kind">
            <OptionSelect id="draft-kind" value={value.kind} onChange={(kind) => set({ kind })} options={KINDS} />
          </Field>
          <Field label="Status" htmlFor="draft-status">
            <OptionSelect id="draft-status" value={value.status} onChange={(status) => set({ status })} options={STATUSES} />
          </Field>
          <Field label="Slug" htmlFor="draft-slug">
            <Input id="draft-slug" className="font-mono" value={value.slug} onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value }) }} />
          </Field>
          <Field label="Project" htmlFor="draft-project">
            <ProjectSelect id="draft-project" value={value.projectId} onChange={(projectId) => set({ projectId })} />
          </Field>
          <p className="border-t border-line-soft pt-3 text-[11px] leading-relaxed text-muted-foreground">Publishing to your site isn't set up yet.</p>
        </Panel>
      </div>
    </>
  )
}
