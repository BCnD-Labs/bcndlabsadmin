import { format } from "date-fns"
import { ChevronDown, ChevronUp, MessageSquareText, NotebookPen, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { PropChip } from "@/components/common/prop-chip"
import { Button } from "@/components/ui/button"
import { parseKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { REFLECTION_ITEMS } from "@shared/planner"
import { learningPreview, readLearningReflection } from "@shared/learning-reflection"
import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { useReflection } from "./reflection-host"
import { attachedReflections, learningReflections } from "./reflection-lists"

const when = (day: string) => format(parseKey(day), "MMM d")
const Chevron = ({ open }: { open: boolean }) => (open ? <ChevronUp className="size-4 shrink-0 text-faint" aria-hidden /> : <ChevronDown className="size-4 shrink-0 text-faint" aria-hidden />)

/** One place to reread the comments you attached to tasks, events and log entries. Read-only: edit them where they were written. */
function Attached() {
  const tasks = useWorkspace((s) => s.tasks)
  const journal = useWorkspace((s) => s.journal)
  const [open, setOpen] = useState<string | null>(null)
  const reviews = useMemo(() => attachedReflections(tasks, journal), [tasks, journal])
  return (
    <Panel category="journal" title="Attached reflections" tool="journal" command="attached" count={reviews.length || undefined}>
      {reviews.length ? <ul>{reviews.map((r) => {
        const on = open === r.id
        return (
          <li key={r.id} className={cn("border-b border-line-soft border-l-[3px] last:border-b-0", on ? "border-l-[var(--bw-category)] bg-selected" : "border-l-transparent hover:bg-raised")}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : r.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
              <span className="grid min-w-0 flex-1 gap-1"><span className="truncate text-[13px] font-semibold text-ink">{r.source}</span><span className="flex flex-wrap gap-1"><PropChip kind="tag" value={r.kind.toUpperCase()} /><PropChip kind="date" label="Day" value={when(r.day)} /></span></span>
              <Chevron open={on} />
            </button>
            {on && <div className="grid gap-1.5 px-3 pb-2.5 text-xs leading-snug text-ink-2">
              {r.reflection.text && <p className="whitespace-pre-line">{r.reflection.text}</p>}
              {Object.entries(r.reflection.items).filter(([, v]) => v?.trim()).map(([key, value]) => <p key={key}><span className="font-semibold text-[var(--bw-category)]">{REFLECTION_ITEMS[key as keyof typeof REFLECTION_ITEMS]?.label ?? key}: </span>{value}</p>)}
            </div>}
          </li>
        )
      })}</ul> : <EmptyState icon={MessageSquareText} title="No attached reflections yet">Reflections you add to tasks, events and log entries gather here.</EmptyState>}
    </Panel>
  )
}

/** Reflections about learning: what clicked, what is still fuzzy, the next small step. Linked to a course and, if you like, one piece of its work. */
function Learning() {
  const journal = useWorkspace((s) => s.journal)
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useWorkspace((s) => s.courses)
  const openEditor = useReflection((s) => s.open)
  const [open, setOpen] = useState<string | null>(null)
  const rows = useMemo(() => learningReflections(journal, tasks), [journal, tasks])
  return (
    <Panel category="learning" title="Learning reflections" tool="journal" command="reflections" count={rows.length || undefined} actions={<Button variant="outline" size="xs" onClick={() => openEditor()}><Plus /> Reflect</Button>}>
      {rows.length ? <ul>{rows.map((entry) => {
        const { item, day } = entry
        const task = tasks.find((t) => t.id === item.taskId)
        const course = courses.find((c) => c.id === (item.courseId ?? task?.courseId))
        const on = open === item.id
        const a = readLearningReflection(item.text)
        return (
          <li key={item.id} className={cn("border-b border-line-soft border-l-[3px] last:border-b-0", on ? "border-l-[var(--bw-category)] bg-selected" : "border-l-transparent hover:bg-raised")}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : item.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
              <span className="grid min-w-0 flex-1 gap-1"><span className="truncate text-[13px] font-semibold text-ink">{task?.title ?? course?.title ?? "Linked item was deleted"}</span>
                <span className="flex flex-wrap gap-1">{task && course && <PropChip kind="course" label="Course" value={course.title} />}<PropChip kind="date" label="Written" value={when(day)} /></span>
                {!on && <span className="truncate text-xs text-muted-foreground">{learningPreview(item.text)}</span>}</span>
              <Chevron open={on} />
            </button>
            {on && <div className="grid gap-1.5 px-3 pb-2.5 text-xs leading-snug text-ink-2">
              {([["What clicked", a.clicked], ["Still fuzzy", a.fuzzy], ["Next step", a.next]] as const).filter(([, v]) => v).map(([label, v]) => <p key={label}><span className="font-semibold text-[var(--bw-category)]">{label}: </span>{v}</p>)}
              {a.notes && <p className="whitespace-pre-line">{a.notes}</p>}
              <Button size="xs" className="w-fit rounded-full" onClick={() => openEditor({ entry, courseId: item.courseId, taskId: item.taskId })}><NotebookPen /> Open reflection</Button>
            </div>}
          </li>
        )
      })}</ul> : <EmptyState icon={NotebookPen} title="No learning reflections yet" action={<Button variant="outline" onClick={() => openEditor()}><Plus /> Reflect</Button>}>A word or a short answer is enough to start.</EmptyState>}
    </Panel>
  )
}

export function ReflectionsView() {
  return (
    <WorkspaceGrid>
      <GridItem span={2}><Attached /></GridItem>
      <GridItem span={2}><Learning /></GridItem>
    </WorkspaceGrid>
  )
}
