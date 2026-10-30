import { ArrowLeft, ExternalLink, Pin, PinOff, Plus, Save, Search, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState, PageHeader } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectTag } from "@/components/common/tags"
import { Field, ProjectSelect } from "@/components/forms/fields"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Note, NoteKind } from "@/lib/types"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

const TITLES: Record<NoteKind, { title: string; one: string; description: string }> = {
  note: { title: "Notes", one: "note", description: "Working notes, linked to projects where useful." },
  reference: { title: "References", one: "reference", description: "Reusable facts: tokens, decisions, conventions." },
  link: { title: "Links", one: "link", description: "Saved URLs with context." },
}

export function KnowledgePage({ kind }: { kind: NoteKind }) {
  const notes = useWorkspace((s) => s.notes)
  const create = useWorkspace((s) => s.create)
  const projects = useProjectMap()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState("")
  const selectedId = params.get("id")
  const meta = TITLES[kind]

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return notes
      .filter((n) => n.kind === kind)
      .filter((n) => !needle || `${n.title} ${n.body} ${n.url ?? ""}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  }, [notes, kind, q])

  const selected = notes.find((n) => n.id === selectedId && n.kind === kind)
  const select = (id: string | null) => setParams(id ? { id } : {}, { replace: false })

  const add = () => {
    const n = create("notes", { title: `Untitled ${meta.one}`, body: "", kind, pinned: false })
    select(n.id)
  }

  return (
    <>
      <PageHeader
        title={meta.title}
        badge={<SourceBadge status="local" />}
        description={meta.description}
        actions={<Button onClick={add}><Plus /> New {meta.one}</Button>}
      />
      <div className="grid gap-3 lg:grid-cols-[20rem_1fr]">
        <section aria-label={`${meta.title} list`} className={cn("rounded-lg border bg-card", selected && "hidden lg:block")}>
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${meta.title.toLowerCase()}`} aria-label={`Filter ${meta.title.toLowerCase()}`} className="h-8 pl-7" />
            </div>
          </div>
          {list.length ? (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {list.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => select(n.id)}
                    aria-current={n.id === selectedId ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-l-2 border-transparent px-3 py-2 text-left outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      n.id === selectedId && "border-amber bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {n.pinned && <Pin className="size-3 text-amber" aria-label="Pinned" />}
                      <span className="truncate text-sm font-bold">{n.title}</span>
                    </span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{n.url ?? (n.body || "Empty")}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ProjectTag project={n.projectId ? projects.get(n.projectId) : undefined} />
                      <span className="ml-auto">{timeAgo(n.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No {meta.title.toLowerCase()} yet.</EmptyState>
          )}
        </section>
        <section aria-label="Editor" className={cn(!selected && "hidden lg:block")}>
          {selected ? (
            <NoteEditor key={selected.id} note={selected} onBack={() => select(null)} onDeleted={() => select(null)} />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Select a {meta.one} or create a new one.
            </div>
          )}
        </section>
      </div>
    </>
  )
}

type Editable = Pick<Note, "title" | "body" | "url" | "projectId">

function NoteEditor({ note, onBack, onDeleted }: { note: Note; onBack: () => void; onDeleted: () => void }) {
  const update = useWorkspace((s) => s.update)
  const remove = useWorkspace((s) => s.remove)
  const togglePin = useWorkspace((s) => s.togglePin)
  const initial: Editable = { title: note.title, body: note.body, url: note.url ?? "", projectId: note.projectId }
  const [value, setValue] = useState<Editable>(initial)
  const [confirm, setConfirm] = useState(false)
  const dirty =
    value.title !== note.title || value.body !== note.body || (value.url ?? "") !== (note.url ?? "") || value.projectId !== note.projectId

  const save = () => {
    if (!value.title.trim()) return toast.error("A title is required")
    update("notes", note.id, { ...value, title: value.title.trim(), url: note.kind === "link" ? value.url?.trim() || undefined : undefined })
    toast.success("Note saved")
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3" data-testid="note-editor">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-1 text-muted-foreground lg:hidden" onClick={onBack}><ArrowLeft /> List</Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">{dirty ? "Unsaved changes" : `Saved ${timeAgo(note.updatedAt)}`}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => togglePin(note.id)} aria-pressed={note.pinned} className={note.pinned ? "text-amber" : "text-muted-foreground"}>
            {note.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin to Home</>}
          </Button>
          {confirm ? (
            <>
              <Button size="sm" variant="destructive" onClick={() => { remove("notes", note.id); toast("Note deleted"); onDeleted() }}>Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="text-red-text" onClick={() => setConfirm(true)} aria-label="Delete note"><Trash2 /></Button>
          )}
          <Button size="sm" onClick={save} disabled={!dirty}><Save /> Save</Button>
        </div>
      </div>
      <label htmlFor="note-edit-title" className="sr-only">Title</label>
      <Input id="note-edit-title" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} className="h-10 border-transparent bg-transparent px-1 text-lg font-bold md:text-lg dark:bg-transparent" />
      <div className="grid gap-3 sm:grid-cols-2">
        {note.kind === "link" && (
          <Field label="URL" htmlFor="note-edit-url">
            <div className="flex gap-1.5">
              <Input id="note-edit-url" type="url" value={value.url} onChange={(e) => setValue({ ...value, url: e.target.value })} className="font-mono text-xs" />
              {value.url && (
                <Button variant="outline" size="icon" asChild>
                  <a href={value.url} target="_blank" rel="noreferrer" aria-label="Open link"><ExternalLink /></a>
                </Button>
              )}
            </div>
          </Field>
        )}
        <Field label="Project" htmlFor="note-edit-project">
          <ProjectSelect id="note-edit-project" value={value.projectId} onChange={(projectId) => setValue({ ...value, projectId })} />
        </Field>
      </div>
      <Field label="Body" htmlFor="note-edit-body">
        <Textarea id="note-edit-body" value={value.body} onChange={(e) => setValue({ ...value, body: e.target.value })} className="min-h-[40vh] leading-relaxed" />
      </Field>
    </div>
  )
}
