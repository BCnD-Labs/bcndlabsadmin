import { format } from "date-fns"
import { BookOpenCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { parseKey, todayKey } from "@/lib/dates"
import { usePrefs } from "@/stores/prefs"
import type { Task } from "@/lib/types"
import { newId } from "@/lib/ids"
import { useWorkspace } from "@/stores/workspace"
import { addSubtasks } from "@shared/records"
import { dueWords, studyPlan } from "@shared/learning"

/** A study plan for one exam: reviews counted back from the exam day. Tick or untick, then add them as steps. Nothing is saved until you press the button. */
/** Inside an open task form the plan goes into the form's own draft (saved with the form), not straight to the workspace. */
export interface StudyDraft { task: Task; onChange: (task: Task) => void }

export function StudyPlanDialog({ taskId, open, onClose, draft }: { taskId: string; open: boolean; onClose: () => void; draft?: StudyDraft }) {
  const stored = useWorkspace((s) => s.tasks)
  const tasks = draft ? stored.map((t) => (t.id === taskId ? draft.task : t)) : stored
  const courses = useWorkspace((s) => s.courses)
  const [off, setOff] = useState<Set<number>>(new Set())
  const perDay = usePrefs((st) => st.planPerDay)
  const today = todayKey()
  const exam = tasks.find((t) => t.id === taskId)
  const plan = open ? studyPlan({ tasks, courses }, taskId, today, perDay) : []
  const chosen = plan.filter((_, i) => !off.has(i))
  const apply = () => {
    const steps = chosen.map((p) => ({ title: p.title, date: p.date, topicId: p.topicId }))
    if (draft) draft.onChange(addSubtasks({ tasks: [draft.task] }, taskId, steps, { makeId: newId }).tasks[0])
    else useWorkspace.setState((s) => addSubtasks({ tasks: s.tasks }, taskId, steps))
    toast.success(`${chosen.length} study step${chosen.length === 1 ? "" : "s"} added to ${exam?.title ?? "the exam"}`)
    setOff(new Set())
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setOff(new Set()); onClose() } }}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Plan studying{exam ? `: ${exam.title}` : ""}</DialogTitle>
        <DialogDescription>
          {exam?.due ? `The exam is ${dueWords(exam.due, today)}. ` : ""}These reviews are spread over the days before it, never more than {perDay} things a day, with a final review the day before.
        </DialogDescription>
        {plan.length ? (
          <ul className="grid max-h-[50vh] gap-0.5 overflow-y-auto" data-testid="study-plan">
            {plan.map((p, i) => (
              <li key={`${p.title}${p.date}`} className="flex min-h-10 items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-raised">
                <Checkbox checked={!off.has(i)} aria-label={`Add ${p.title}`} onCheckedChange={(on) => setOff((s) => { const n = new Set(s); if (on) n.delete(i); else n.add(i); return n })} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.title}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-2">{p.date === today ? "Today" : format(parseKey(p.date), "EEE, MMM d")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">Nothing to add. Either the exam is today or past, or its reviews are already steps on it.</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!chosen.length} onClick={apply}><BookOpenCheck /> Add {chosen.length} step{chosen.length === 1 ? "" : "s"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StudyPlanButton({ taskId, size = "sm", label = "Plan my studying", draft }: { taskId: string; size?: "sm" | "xs"; label?: string; draft?: StudyDraft }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}><BookOpenCheck /> {label}</Button>
      <StudyPlanDialog taskId={taskId} open={open} onClose={() => setOpen(false)} draft={draft} />
    </>
  )
}
