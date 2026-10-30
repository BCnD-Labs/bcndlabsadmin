import {
  CheckCircle2,
  Circle,
  FileText,
  FolderKanban,
  Link2,
  NotebookText,
  Plus,
} from "lucide-react"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { draftHref, noteHref, projectHref } from "@/lib/routes"
import { DRAFT_STATUS_LABEL } from "@/components/common/tags"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { NAV } from "./nav-config"

/** Global search over local records plus navigation and create actions. */
export function CommandSearch() {
  const open = useUi((s) => s.searchOpen)
  const setOpen = useUi((s) => s.setSearchOpen)
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()
  const createDraft = useCreateDraft()
  const { tasks, projects, notes, drafts } = useWorkspace()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!useUi.getState().searchOpen)
        return
      }
      const t = e.target as HTMLElement
      const typing = t.closest("input, textarea, select, [contenteditable=true]")
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [setOpen])

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.code ?? ""

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search workspace"
      description="Search tasks, projects, notes and drafts"
      className="sm:max-w-xl"
    >
      <Command>
      <CommandInput placeholder="Search tasks, projects, notes, drafts…" />
      <CommandList className="max-h-[min(60vh,420px)]">
        <CommandEmpty>No local records match.</CommandEmpty>

        {tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {tasks.map((t) => (
              <CommandItem
                key={t.id}
                value={`task ${t.title} ${projectName(t.projectId)} ${t.id}`}
                onSelect={() => run(() => openForm({ kind: "task", id: t.id }))}
              >
                {t.status === "done" ? <CheckCircle2 className="text-teal" /> : <Circle />}
                <span className={t.status === "done" ? "text-muted-foreground line-through" : ""}>{t.title}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{projectName(t.projectId)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={p.id}
                value={`project ${p.name} ${p.code} ${p.id}`}
                onSelect={() => run(() => navigate(projectHref(p.id)))}
              >
                <FolderKanban />
                {p.name}
                <span className="ml-auto font-mono text-xs text-muted-foreground">{p.code}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {notes.length > 0 && (
          <CommandGroup heading="Notes">
            {notes.map((n) => (
              <CommandItem
                key={n.id}
                value={`note ${n.title} ${n.body.slice(0, 200)} ${n.id}`}
                onSelect={() => run(() => navigate(noteHref(n)))}
              >
                {n.kind === "link" ? <Link2 /> : <NotebookText />}
                {n.title}
                <span className="ml-auto text-xs text-muted-foreground capitalize">{n.kind}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {drafts.length > 0 && (
          <CommandGroup heading="Drafts">
            {drafts.map((d) => (
              <CommandItem
                key={d.id}
                value={`draft ${d.title} ${d.slug} ${d.id}`}
                onSelect={() => run(() => navigate(draftHref(d.id)))}
              >
                <FileText />
                {d.title}
                <span className="ml-auto text-xs text-muted-foreground">{DRAFT_STATUS_LABEL[d.status]}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV.flatMap((d) =>
            (d.children ?? [{ label: d.label, to: d.to }]).map((c) => {
              const Icon = d.icon
              const label = d.children ? `${d.label} › ${c.label}` : c.label
              return (
                <CommandItem key={c.to} value={`go ${label}`} onSelect={() => run(() => navigate(c.to))}>
                  <Icon />
                  {label}
                </CommandItem>
              )
            }),
          )}
        </CommandGroup>
        <CommandGroup heading="Create">
          {(["task", "event", "note", "project", "repo"] as const).map((kind) => (
            <CommandItem
              key={kind}
              value={`create new ${kind === "repo" ? "repository link" : kind}`}
              onSelect={() => run(() => openForm({ kind }))}
            >
              <Plus />
              New {kind === "repo" ? "repository link" : kind}
            </CommandItem>
          ))}
          <CommandItem value="create new content draft" onSelect={() => run(() => navigate(draftHref(createDraft().id)))}>
            <Plus />
            New content draft
          </CommandItem>
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
