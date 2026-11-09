import { CalendarDays, GraduationCap, X } from "lucide-react"
import { useMemo } from "react"
import { Link } from "react-router-dom"
import { statusLabel, statusOf } from "@shared/learning"
import { withLink } from "@shared/links"
import { tasksLinkingTo, type SiteLinkKind } from "@shared/site-links"
import { Button } from "@/components/ui/button"
import { courseHref, plannerHref } from "@/lib/routes"
import type { Task } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"

const taskHref = (t: Task) => (t.courseId ? courseHref(t.courseId) : `${plannerHref}?task=${t.id}`)

/** The tasks linked to a page or post, each opening where it lives, and a way to link another. Linking never changes a task's status. */
export function RecordTasks({ kind, id, name }: { kind: SiteLinkKind; id: string; name: string }) {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const update = useWorkspace((s) => s.update)
  const linked = useMemo(() => tasksLinkingTo({ tasks }, kind, id), [tasks, kind, id])
  const choices = useMemo(() => tasks.filter((t) => t.kind !== "event" && !linked.includes(t)).sort((a, b) => Number(a.done) - Number(b.done) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 150), [tasks, linked])
  const setLink = (t: Task, on: boolean) => {
    const next = withLink(t.recordLinks, { kind, id }, on)
    update("tasks", t.id, { recordLinks: next.length ? next : undefined })
  }
  return (
    <div className="grid gap-2" data-testid="record-tasks">
      {linked.length ? (
        <ul className="grid gap-1">
          {linked.map((t) => {
            const course = courses.find((c) => c.id === t.courseId)
            const Icon = course ? GraduationCap : CalendarDays
            const facts = [t.due ? `Due ${t.due}` : "No due date", course?.code, course ? statusLabel(statusOf(t)) : t.done ? "Done" : "Open"].filter(Boolean).join(" · ")
            return (
              <li key={t.id} className="flex items-center gap-1 rounded-md border border-line-soft">
                <Link to={taskHref(t)} className="flex min-w-0 flex-1 items-start gap-2 p-2 text-left hover:bg-raised">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0"><span className="block truncate text-[12.5px] text-ink">{t.title}</span><span className="block truncate text-[11px] text-muted-foreground">{facts}</span></span>
                </Link>
                <Button variant="quiet" size="icon-xs" aria-label={`Unlink ${t.title}`} onClick={() => setLink(t, false)}><X /></Button>
              </li>
            )
          })}
        </ul>
      ) : <p className="text-xs text-muted-foreground">No tasks link to this {kind} yet.</p>}
      <select aria-label={`Link a task to ${name}`} className="h-8 w-full rounded-md border border-line bg-well px-2 text-xs text-ink" value="" onChange={(e) => { const t = tasks.find((x) => x.id === e.target.value); if (t) setLink(t, true) }}>
        <option value="">+ Link a task…</option>
        {choices.map((t) => <option key={t.id} value={t.id}>{t.title.slice(0, 80)}</option>)}
      </select>
    </div>
  )
}
