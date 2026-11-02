import {
  CheckCircle2,
  Circle,
  FileText,
  FolderKanban,
  GraduationCap,
  NotebookPen,
  StickyNote,
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
import { courseHref, draftHref, noteHref, projectHref } from "@/lib/routes"
import { CATEGORIES } from "@/components/common/category-icon"
import { courseLabel } from "@/features/learning/learning-utils"
import { DRAFT_STATUS_LABEL } from "@/components/common/tags"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { logHref } from "@/lib/routes"
import { noteTitle } from "@/features/notes/note-colors"
import { format } from "date-fns"
import { parseKey, todayKey } from "@/lib/dates"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { NAV } from "./nav-config"

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Every word you type must appear in the item's text. Ranking: starts with the
 * query > a word starts with it > contains it > words found separately.
 */
function rank(_value: string, search: string, keywords?: string[]): number {
  const q = search.trim().toLowerCase()
  if (!q) return 1
  const hay = (keywords ?? []).join(" \u2022 ").toLowerCase()
  if (!q.split(/\s+/).every((w) => hay.includes(w))) return 0
  if (hay.startsWith(q)) return 1
  if (new RegExp(`\\b${escapeRe(q)}`).test(hay)) return 0.9
  if (hay.includes(q)) return 0.75
  return 0.5
}

/** Global search over local records plus navigation and create actions. */
export function CommandSearch() {
  const open = useUi((s) => s.searchOpen)
  const setOpen = useUi((s) => s.setSearchOpen)
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()
  const createDraft = useCreateDraft()
  const { tasks, projects, notes, drafts, journal, courses } = useWorkspace()

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

  const courseCodes = new Map(courses.map((c) => [c.id, `${courseLabel(c)} ${c.title}`]))

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search workspace"
      description="Search tasks, coursework, courses, notes, daily logs, projects and drafts"
      className="sm:max-w-xl"
    >
      <Command filter={rank}>
      <CommandInput placeholder="Search tasks, courses, notes, logs, projects, drafts…" />
      <CommandList className="max-h-[min(60vh,420px)]">
        <CommandEmpty>No local records match.</CommandEmpty>

        {tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {tasks.map((t) => (
              <CommandItem
                key={t.id}
                value={`task-${t.id}`}
                keywords={[t.title, t.details ?? "", ...(t.courseId ? [courseCodes.get(t.courseId) ?? ""] : [])]}
                onSelect={() => run(() => openForm({ kind: "task", id: t.id }))}
              >
                {t.done ? <CheckCircle2 className="text-muted-foreground" /> : <Circle />}
                <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.title}</span>
                {t.due && <span className="ml-auto font-mono text-xs text-muted-foreground">{t.due}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {courses.length > 0 && (
          <CommandGroup heading="Courses">
            {courses.map((c) => (
              <CommandItem
                key={c.id}
                value={`course-${c.id}`}
                keywords={[c.title, c.code, c.instructor, c.term, ...c.tags]}
                onSelect={() => run(() => navigate(courseHref(c.id)))}
              >
                <GraduationCap />
                {c.title}
                <span className="ml-auto font-mono text-xs text-muted-foreground">{courseLabel(c)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={p.id}
                value={`project-${p.id}`}
                keywords={[p.name, p.code]}
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
                value={`note-${n.id}`}
                keywords={[n.text.slice(0, 500)]}
                onSelect={() => run(() => navigate(noteHref(n.id)))}
              >
                <StickyNote />
                <span className="truncate">{noteTitle(n.text)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {journal.length > 0 && (
          <CommandGroup heading="Daily logs">
            {[...journal].sort((a, b) => b.id.localeCompare(a.id)).map((j) => (
              <CommandItem key={j.id} value={`log-${j.id}`} keywords={[j.id, format(parseKey(j.id), "EEEE MMMM d"), j.text.slice(0, 2000)]} onSelect={() => run(() => navigate(logHref(j.id)))}>
                <NotebookPen />
                <span className="font-mono text-xs">{j.id}</span>
                <span className="truncate text-muted-foreground">{j.text.split("\n")[0]}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {drafts.length > 0 && (
          <CommandGroup heading="Drafts">
            {drafts.map((d) => (
              <CommandItem
                key={d.id}
                value={`draft-${d.id}`}
                keywords={[d.title, d.slug]}
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
              const Icon = CATEGORIES[d.category]
              const label = d.children ? `${d.label} › ${c.label}` : c.label
              return (
                <CommandItem key={c.to} value={`go-${c.to}`} keywords={["go to", label]} onSelect={() => run(() => navigate(c.to))}>
                  <Icon />
                  {label}
                </CommandItem>
              )
            }),
          )}
        </CommandGroup>
        <CommandGroup heading="Create">
          {(["task", "note", "course", "project", "repo"] as const).map((kind) => (
            <CommandItem
              key={kind}
              value={`create-${kind}`}
              keywords={["new", kind === "repo" ? "repository link" : kind]}
              onSelect={() => run(() => openForm({ kind }))}
            >
              <Plus />
              New {kind === "repo" ? "repository link" : kind}
            </CommandItem>
          ))}
          <CommandItem value="create-log" keywords={["today's log", "daily log", "journal", "write"]} onSelect={() => run(() => navigate(logHref(todayKey())))}>
            <NotebookPen />
            Today's log
          </CommandItem>
          <CommandItem value="create-draft" keywords={["new", "content draft"]} onSelect={() => run(() => navigate(draftHref(createDraft().id)))}>
            <Plus />
            New content draft
          </CommandItem>
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
