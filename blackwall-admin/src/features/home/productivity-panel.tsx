import { Plus } from "lucide-react"
import { useMemo, useState, type KeyboardEvent } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DueChip } from "@/components/common/due-chip"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { daysUntil, shortAgo, todayKey } from "@/lib/dates"
import type { Note, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { compareTasks } from "@/features/work/task-utils"
import type { PanelBodyProps } from "./panel-registry"

type Tab = "today" | "next" | "done"

/** Today = open and due today or overdue. Next = open and due later or undated. Done = done. */
const inTab = (t: Task, tab: Tab) =>
  tab === "done" ? t.done : !t.done && (tab === "today" ? !!t.due && daysUntil(t.due) <= 0 : !t.due || daysUntil(t.due) > 0)

const EMPTY: Record<Tab, string> = {
  today: "Nothing due today.",
  next: "Nothing coming up.",
  done: "Nothing completed yet.",
}

function usePinned(): Note[] {
  const notes = useWorkspace((s) => s.notes)
  return useMemo(() => notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3), [notes])
}

/** Header meta: "N open · N notes". */
export function ProductivityMeta() {
  const open = useWorkspace((s) => s.tasks.filter((t) => inTab(t, "today")).length)
  const notes = useWorkspace((s) => s.notes.length)
  return (
    <>
      {open} open · {notes} {notes === 1 ? "note" : "notes"}
    </>
  )
}

/** Spec §3 Productivity: tasks on the left (~57%), pinned notes on the right. Local data only. */
export function ProductivityPanel({ slot }: PanelBodyProps) {
  const tasks = useWorkspace((s) => s.tasks)
  const create = useWorkspace((s) => s.create)
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const openForm = useUi((s) => s.openForm)
  const notes = usePinned()
  const [tab, setTab] = useState<Tab>("today")
  const [draft, setDraft] = useState("")
  // Tasks checked off here stay visible (struck through) until the tab changes.
  const [lingering, setLingering] = useState<Set<string>>(new Set())

  const rows = useMemo(
    () => tasks.filter((t) => inTab(t, tab) || lingering.has(t.id)).sort(compareTasks),
    [tasks, tab, lingering],
  )
  const count = (k: Tab) => tasks.filter((t) => inTab(t, k)).length

  const changeTab = (t: Tab) => {
    setTab(t)
    setLingering(new Set())
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !draft.trim()) return
    e.preventDefault()
    create("tasks", { title: draft.trim(), due: todayKey(), starred: false, done: false })
    setDraft("")
    if (tab !== "today") changeTab("today")
  }

  const idBase = `slot${slot}-tasks`

  return (
    <div className="grid flex-1 grid-cols-1 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="flex min-h-56 min-w-0 flex-col gap-[9px] border-b border-line pt-3 pr-3 pb-3.5 pl-3.5 sm:border-r sm:border-b-0">
        <SegmentedTabs
          label="Task views"
          idBase={idBase}
          value={tab}
          onChange={changeTab}
          tabs={[
            { value: "today", label: "Today", count: count("today") },
            { value: "next", label: "Next", count: count("next") },
            { value: "done", label: "Done", count: count("done") },
          ]}
        />
        <label className="flex h-8 shrink-0 items-center gap-2 rounded-[7px] border border-dashed border-[#3A3D43] bg-well px-2.5 focus-within:border-ledge-hi">
          <Plus className="size-3 shrink-0 text-faint" strokeWidth={2} aria-hidden />
          <input
            aria-label="New task, due today"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Add a task… Enter"
            className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-ink outline-none"
          />
        </label>
        <div
          id={`${idBase}-panel`}
          role="tabpanel"
          aria-labelledby={`${idBase}-tab-${tab}`}
          className="-mx-1 min-h-0 flex-1 basis-0 overflow-y-auto px-1"
        >
          {rows.length ? (
            <ul className="flex flex-col">
              {rows.map((t) => (
                <li
                  key={t.id}
                  className="flex h-9 shrink-0 items-center gap-2.5 rounded-[6px] border-b border-line-soft px-1 hover:bg-raised"
                  data-testid="prod-task"
                >
                  <Checkbox
                    checked={t.done}
                    onCheckedChange={() => {
                      toggleTask(t.id)
                      if (!t.done) setLingering((s) => new Set(s).add(t.id))
                    }}
                    aria-label={t.done ? `Mark "${t.title}" as not done` : `Complete "${t.title}"`}
                  />
                  <button
                    type="button"
                    onClick={() => openForm({ kind: "task", id: t.id })}
                    title="Edit task"
                    className={cn(
                      "min-w-0 flex-1 truncate text-left font-mono text-[11px]",
                      t.done ? "text-faint line-through" : "text-ink",
                    )}
                  >
                    {t.title}
                  </button>
                  {t.due && <DueChip due={t.due} done={t.done} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-4 text-[11px] text-muted-foreground">
              {tasks.length === 0 ? "No tasks yet. Type one above and press Enter." : EMPTY[tab]}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-[7px] pt-3 pr-3.5 pb-3.5 pl-3">
        <div className="flex items-center justify-between">
          <h3 className="bw-label">Pinned notes</h3>
          <Button
            variant="ghost"
            aria-label="New note"
            className="h-[22px] w-6 p-0"
            onClick={() => openForm({ kind: "note", defaults: { pinned: true } })}
          >
            +
          </Button>
        </div>
        {notes.length ? (
          <ul className="flex flex-col gap-[7px]">
            {notes.map((n) => {
              const [title, ...rest] = n.text.trim().split("\n")
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openForm({ kind: "note", id: n.id })}
                    className="flex w-full flex-col gap-1 rounded-[8px] border-t border-r-[3px] border-b-[3px] border-l border-ledge bg-raised px-2.5 py-2 text-left hover:border-ledge-hi"
                    data-testid="prod-note"
                  >
                    <span className="flex w-full items-center justify-between gap-1.5">
                      <span className="truncate font-heading text-xs font-bold text-ink">{title || "Empty note"}</span>
                      <span className="shrink-0 text-[9px] text-faint">{shortAgo(n.updatedAt)}</span>
                    </span>
                    {rest.join(" ").trim() && (
                      <span className="line-clamp-2 text-[10px] leading-[1.5] text-[#A3A8B1]">{rest.join(" ").trim()}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No pinned notes. Pin one in{" "}
            <Link to="/notes" className="text-ink-2 underline-offset-2 hover:underline">
              Notes
            </Link>{" "}
            and it shows here.
          </p>
        )}
      </div>
    </div>
  )
}
