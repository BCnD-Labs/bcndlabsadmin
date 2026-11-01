import { ChevronDown, ListChecks, Plus, Star } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ListGroupLabel, SearchField, Toolbar } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
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
  const filtered = !!q.trim() || starredOnly

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Everything you've noted down, grouped by when it's due."
        actions={
          <Button size="lg" onClick={() => openForm({ kind: "task", defaults: { starred: starredOnly } })}>
            <Plus /> New task
          </Button>
        }
      />
      <Panel tool="tasks" command={starredOnly ? "list --starred" : "list"} meta={`${openCount} open · ${tasks.length - openCount} done`} className="max-w-4xl">
        <Toolbar>
          <SearchField value={q} onChange={setQ} label="Search tasks" className="flex-1 sm:flex-none" />
          <Button variant="outline" size="lg" aria-pressed={starredOnly} onClick={() => setStarredOnly(!starredOnly)}>
            <Star className={cn(starredOnly && "fill-current text-amber")} /> Starred
          </Button>
        </Toolbar>
        <form onSubmit={add} className="flex items-center gap-2.5 border-b border-line px-3.5 py-1.5">
          <Plus className="size-3.5 shrink-0 text-faint" aria-hidden />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Add a task · end with “fri” to set a date"
            aria-label="Add a task"
            className="h-8 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint md:text-[13px]"
          />
        </form>
        {groups.length ? (
          groups.map((g) => (
            <section key={g.name} aria-label={g.name}>
              <ListGroupLabel tone={g.name === "Overdue" ? "warn" : undefined}>
                {g.name} <span className="text-faint">· {g.items.length}</span>
              </ListGroupLabel>
              <ul>{g.items.map((t) => <TaskRow key={t.id} task={t} showDetails />)}</ul>
            </section>
          ))
        ) : filtered ? (
          <EmptyState
            title="No open tasks match"
            action={<Button variant="outline" onClick={() => (setQ(""), setStarredOnly(false))}>Clear filters</Button>}
          />
        ) : (
          <EmptyState icon={ListChecks} title={tasks.length ? "All done" : "No tasks yet"}>
            Type one in the line above and press Enter.
          </EmptyState>
        )}
        {done.length > 0 && (
          <section aria-label="Completed" className="border-t border-line">
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone(!showDone)}
              className="bw-label flex h-9 w-full items-center gap-1.5 px-3.5 text-left hover:text-ink"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} aria-hidden />
              Completed <span className="text-faint">· {done.length}</span>
            </button>
            {showDone && <ul className="border-t border-line-soft">{done.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
          </section>
        )}
      </Panel>
    </>
  )
}
