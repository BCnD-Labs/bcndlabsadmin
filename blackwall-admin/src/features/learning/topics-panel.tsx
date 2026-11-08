import { ChevronDown, ChevronRight, Layers, Plus } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TopicsField } from "@/components/forms/topics-field"
import type { Course, CourseTopic } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { removeCourseTopic } from "@shared/records"
import { topicUsage } from "@shared/learning"
import { cn } from "@/lib/utils"
import { AddWorkDialog } from "./add-work-dialog"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** A course's modules (units, chapters, topics). Open one to see its work, add work to it, and tick the ones you know. */
export function TopicsPanel({ course }: { course: Course }) {
  const tasks = useWorkspace((s) => s.tasks)
  const allNotes = useWorkspace((s) => s.notes)
  const courses = useWorkspace((s) => s.courses)
  const update = useWorkspace((s) => s.update)
  const [editing, setEditing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const topics = course.topics ?? []
  const use = new Map(topicUsage({ tasks, courses }, course.id).map((u) => [u.topicId, u]))
  const known = topics.filter((t) => t.done).length
  const save = (next: CourseTopic[]) => {
    // A topic dropped in the editor is also unlinked from this course's work.
    const gone = topics.filter((t) => !next.some((n) => n.id === t.id))
    for (const t of gone) useWorkspace.setState((s) => removeCourseTopic({ tasks: s.tasks, courses: s.courses }, course.id, t.id))
    update("courses", course.id, { topics: next.length ? next : undefined })
  }
  return (
    <Panel category="learning" title="Modules" tool="course" command="topics" meta={topics.length ? `${known} of ${topics.length} known` : undefined}
      actions={<Button variant="quiet" size="sm" onClick={() => setEditing((v) => !v)}>{editing ? "Done" : topics.length ? "Edit" : "Add"}</Button>}
      bodyClassName={editing ? "px-3.5 py-3" : undefined}>
      {editing ? (
        <TopicsField value={topics} onChange={save} />
      ) : topics.length ? (
        <>
        <ul>
          {topics.map((t) => {
            const u = use.get(t.id)
            const work = tasks.filter((x) => x.courseId === course.id && x.topicIds?.includes(t.id) && x.kind !== "event").sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
            const doneCount = work.filter((x) => x.done).length
            const open = openId === t.id
            const bits = [u?.assignments ? plural(u.assignments, "assignment") : "", u?.exams ? plural(u.exams, "exam") : ""].filter(Boolean)
            return (
              <li key={t.id} className="border-b border-line-soft last:border-b-0" data-testid="topic-row">
                <div className="flex min-h-10 items-center gap-2.5 px-3.5 py-1.5">
                  <Checkbox checked={!!t.done} aria-label={`I know ${t.title}`} onCheckedChange={(done) => update("courses", course.id, { topics: topics.map((x) => (x.id === t.id ? { ...x, done: done === true || undefined } : x)) })} />
                  <button type="button" onClick={() => setOpenId(open ? null : t.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    {open ? <ChevronDown className="size-3.5 shrink-0 text-faint" aria-hidden /> : <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />}
                    <span className={cn("min-w-0 flex-1 truncate text-[13px] text-ink", t.done && "text-faint line-through")}>{t.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{work.length ? `${doneCount}/${work.length} done` : bits.join(" · ") || "No work yet"}</span>
                  </button>
                </div>
                {open && (
                  <div className="pb-2 pl-10 pr-3.5">
                    {work.length ? <ul className="grid gap-0.5">{work.map((x) => (
                      <li key={x.id} className="flex min-h-8 items-center gap-2 text-[12.5px]"><Checkbox checked={x.done} aria-label={`${x.title}: done`} onCheckedChange={() => useWorkspace.getState().toggleTask(x.id)} /><span className={cn("min-w-0 flex-1 truncate text-ink-2", x.done && "line-through text-faint")}>{x.title}</span><span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{x.due ?? ""}</span></li>
                    ))}</ul> : <p className="text-xs text-muted-foreground">Nothing in this module yet.</p>}
                    {(() => { const mine = allNotes.filter((n) => n.courseId === course.id && n.topicIds?.includes(t.id)); return mine.length ? <ul className="mt-1.5 grid gap-0.5 border-t border-line-soft pt-1.5">{mine.map((n) => <li key={n.id} className="truncate text-[12px] text-ink-2" title={n.text}>📝 {n.text.split("\n")[0]}</li>)}</ul> : null })()}
                    <Button variant="outline" size="xs" className="mt-1.5" onClick={() => setAdding(t.id)}><Plus /> Add work</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {adding && topics.find((t) => t.id === adding) && <AddWorkDialog course={course} module={topics.find((t) => t.id === adding)!} onClose={() => setAdding(null)} />}
        </>
      ) : (
        <EmptyState icon={Layers} title="No modules yet">Add the modules (or units, chapters, topics) of this class. Then each assignment can sit in one, and exam studying is planned module by module. <Link className="underline" to="#" onClick={(e) => { e.preventDefault(); setEditing(true) }}>Add modules</Link></EmptyState>
      )}
    </Panel>
  )
}
