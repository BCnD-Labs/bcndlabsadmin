import { ChevronDown, Plus, Search, Star } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState, PageHeader } from "@/components/common/panel"
import { parseQuickAdd } from "@/lib/quick-add"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { TaskRow } from "./task-row"
import { GROUP_ORDER, compareTasks, groupOf } from "./task-utils"

/** One list grouped by when things are due, Google Tasks style. */
export function TasksPage() {
  const tasks = useWorkspace((s) => s.tasks)
  const create = useWorkspace((s) => s.create)
  const openForm = useUi((s) => s.openForm)
  const [q, setQ] = useState("")
  const [starredOnly, setStarredOnly] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [quick, setQuick] = useState("")

  const { groups, done } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (t: (typeof tasks)[number]) =>
      (!needle || t.title.toLowerCase().includes(needle) || t.details?.toLowerCase().includes(needle)) && (!starredOnly || t.starred)
    const open = tasks.filter((t) => !t.done && match(t)).sort(compareTasks)
    return {
      groups: GROUP_ORDER.map((g) => ({ name: g, items: open.filter((t) => groupOf(t) === g) })).filter((g) => g.items.length),
      done: tasks.filter((t) => t.done && match(t)).sort(compareTasks),
    }
  }, [tasks, q, starredOnly])

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!quick.trim()) return
    const { title, due } = parseQuickAdd(quick)
    create("tasks", { title, due, starred: starredOnly, done: false })
    setQuick("")
  }

  const openCount = tasks.filter((t) => !t.done).length

  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${openCount} open · ${tasks.length - openCount} done`}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="h-8 w-48 pl-7" />
            </div>
            <Button variant="outline" aria-pressed={starredOnly} onClick={() => setStarredOnly(!starredOnly)} className={cn(starredOnly && "text-amber")}>
              <Star className={cn(starredOnly && "fill-current")} /> Starred
            </Button>
            <Button onClick={() => openForm({ kind: "task", defaults: { starred: starredOnly } })}>
              <Plus /> New task
            </Button>
          </>
        }
      />
      <div className="max-w-4xl brutal rounded-xl bg-card">
        <form onSubmit={add} className="flex items-center gap-2 border-b px-3 py-2">
          <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Add a task (Enter). End with today / tomorrow / fri to set a date."
            aria-label="Add a task"
            className="h-7 border-transparent bg-transparent px-1 dark:bg-transparent"
          />
        </form>
        {groups.length ? (
          groups.map((g) => (
            <section key={g.name} aria-label={g.name}>
              <h2 className={cn("eyebrow border-b bg-recessed/40 px-3 py-1.5", g.name === "Overdue" && "text-red-text")}>
                {g.name} · {g.items.length}
              </h2>
              <ul>{g.items.map((t) => <TaskRow key={t.id} task={t} showDetails />)}</ul>
            </section>
          ))
        ) : (
          <EmptyState>{q || starredOnly ? "No open tasks match." : "No open tasks."}</EmptyState>
        )}
        {done.length > 0 && (
          <section aria-label="Completed">
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone(!showDone)}
              className="eyebrow flex w-full items-center gap-1.5 border-t bg-recessed/40 px-3 py-1.5 text-left hover:text-foreground"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} aria-hidden />
              Completed · {done.length}
            </button>
            {showDone && <ul>{done.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
          </section>
        )}
      </div>
    </>
  )
}
