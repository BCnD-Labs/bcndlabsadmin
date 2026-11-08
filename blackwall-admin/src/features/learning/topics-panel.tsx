import { Layers } from "lucide-react"
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** A course's units, modules or chapters. Tick the ones you know; see which work covers each. */
export function TopicsPanel({ course }: { course: Course }) {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const update = useWorkspace((s) => s.update)
  const [editing, setEditing] = useState(false)
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
    <Panel category="learning" title="Topics" tool="course" command="topics" meta={topics.length ? `${known} of ${topics.length} known` : undefined}
      actions={<Button variant="quiet" size="sm" onClick={() => setEditing((v) => !v)}>{editing ? "Done" : topics.length ? "Edit" : "Add"}</Button>}
      bodyClassName={editing ? "px-3.5 py-3" : undefined}>
      {editing ? (
        <TopicsField value={topics} onChange={save} />
      ) : topics.length ? (
        <ul>
          {topics.map((t) => {
            const u = use.get(t.id)
            const bits = [u?.assignments ? plural(u.assignments, "assignment") : "", u?.exams ? plural(u.exams, "exam") : ""].filter(Boolean)
            return (
              <li key={t.id} className="flex min-h-10 items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0" data-testid="topic-row">
                <Checkbox checked={!!t.done} aria-label={`I know ${t.title}`} onCheckedChange={(done) => update("courses", course.id, { topics: topics.map((x) => (x.id === t.id ? { ...x, done: done === true || undefined } : x)) })} />
                <span className={cn("min-w-0 flex-1 truncate text-[13px] text-ink", t.done && "text-faint line-through")}>{t.title}</span>
                {bits.length > 0 && <span className="shrink-0 text-[11px] text-muted-foreground">{bits.join(" · ")}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon={Layers} title="No topics yet">Add the units or modules of this class. Assignments and exams can then say which ones they cover, and exam studying is planned topic by topic. <Link className="underline" to="#" onClick={(e) => { e.preventDefault(); setEditing(true) }}>Add topics</Link></EmptyState>
      )}
    </Panel>
  )
}
