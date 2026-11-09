import { FileText, ListChecks, NotebookPen, X } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import type { RecordLink, Task } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { MAX_RECORD_LINKS, hasLink, noteTitle, withLink } from "@shared/links"

const SELECT = "h-9 w-full rounded-md border border-line bg-well px-2 text-[13px] text-ink"

/** Notes, other tasks and day logs this task is linked to. Linking is the same record the Planner uses; "Linked from" shows tasks that point here. */
export function LinkedRecordsField({ value, onChange, selfId, backlinks = [] }: { value: RecordLink[]; onChange: (next: RecordLink[]) => void; selfId?: string; backlinks?: Task[] }) {
  const notes = useWorkspace((s) => s.notes)
  const tasks = useWorkspace((s) => s.tasks)
  const options = useMemo(() => ({
    notes: notes.filter((n) => !hasLink(value, "note", n.id)).slice(0, 150),
    tasks: tasks.filter((t) => t.id !== selfId && t.kind !== "event" && !hasLink(value, "task", t.id)).slice(0, 150),
  }), [notes, tasks, value, selfId])
  const label = (l: RecordLink) => {
    if (l.kind === "note") { const n = notes.find((x) => x.id === l.id); return { text: n ? noteTitle(n) : "Deleted note", icon: NotebookPen } }
    if (l.kind === "task") { const t = tasks.find((x) => x.id === l.id); return { text: t ? t.title : "Deleted task", icon: ListChecks } }
    return { text: `Log: ${l.id}`, icon: FileText }
  }
  const add = (raw: string) => {
    const [kind, id] = raw.split(":") as [RecordLink["kind"], string]
    if (id) onChange(withLink(value, { kind, id }, true))
  }
  return (
    <div className="grid gap-2" data-testid="linked-records">
      {value.length > 0 && (
        <ul className="grid gap-1">{value.map((l) => {
          const { text, icon: Icon } = label(l)
          return <li key={`${l.kind}:${l.id}`} className="flex items-center gap-2 rounded-md border border-line-soft px-2 py-1 text-[13px]"><Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /><span className="min-w-0 flex-1 truncate text-ink-2">{text}</span><Button type="button" variant="quiet" size="icon-sm" aria-label={`Unlink ${text}`} onClick={() => onChange(withLink(value, l, false))}><X /></Button></li>
        })}</ul>
      )}
      <select aria-label="Link a note or task" className={SELECT} value="" disabled={value.length >= MAX_RECORD_LINKS} onChange={(e) => add(e.target.value)}>
        <option value="">+ Link a note or task…</option>
        {options.notes.length > 0 && <optgroup label="Notes">{options.notes.map((n) => <option key={n.id} value={`note:${n.id}`}>{noteTitle(n).slice(0, 80)}</option>)}</optgroup>}
        {options.tasks.length > 0 && <optgroup label="Tasks and coursework">{options.tasks.map((t) => <option key={t.id} value={`task:${t.id}`}>{t.title.slice(0, 80)}</option>)}</optgroup>}
      </select>
      {backlinks.length > 0 && <p className="text-[11px] text-muted-foreground">Linked from: {backlinks.map((t) => t.title).join(", ")}</p>}
    </div>
  )
}
