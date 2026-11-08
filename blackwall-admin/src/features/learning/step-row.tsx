import { Checkbox } from "@/components/ui/checkbox"
import type { Course } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { toggleSubtask } from "@shared/records"
import { dueWords } from "@shared/learning"
import type { StepRef } from "@shared/steps"
import { CourseTag } from "./coursework"

/** One planned step: tick it off, or open the task it belongs to. */
export function StepRow({ item, course, today }: { item: StepRef; course?: Course; today: string }) {
  const openForm = useUi((s) => s.openForm)
  const { task, step } = item
  const late = !!step.date && step.date < today
  return (
    <li className="flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0 hover:bg-raised" data-testid="step-today">
      <Checkbox checked={step.done} aria-label={`Finish step: ${step.title}`} onCheckedChange={() => useWorkspace.setState((s) => toggleSubtask({ tasks: s.tasks }, task.id, step.id))} />
      <button type="button" onClick={() => openForm({ kind: "task", id: task.id })} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-[13px] text-ink", step.done && "text-faint line-through")}>{step.title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"><CourseTag course={course} asLink={false} className="h-[18px] text-[10px]" /><span className="truncate">{task.title}</span></span>
      </button>
      {late && <span className="shrink-0 text-[11px] text-amber">{dueWords(step.date!, today)}</span>}
    </li>
  )
}
