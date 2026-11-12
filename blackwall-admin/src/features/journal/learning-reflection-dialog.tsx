import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { newId } from "@/lib/ids"
import { todayKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { LEARNING_PROMPTS, hasLearningAnswers, readLearningReflection, writeLearningReflection, type LearningAnswers } from "@shared/learning-reflection"
import type { LearningEntry } from "./reflection-lists"

function Choice({ on, children, onClick }: { on: boolean; children: string; onClick: () => void }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={cn("h-8 max-w-56 truncate rounded-full border px-3 text-[12.5px]", on ? "border-[var(--bw-blue,#64b5f6)] bg-[#64b5f622] text-ink" : "border-line text-ink-2 hover:bg-raised")}>{children}</button>
}

/** Write or edit a learning reflection: pick what it is about, answer three short questions, add notes if you like. */
export function LearningReflectionDialog({ courseId: initialCourse, taskId: initialTask, entry, onClose }: { courseId?: string; taskId?: string; entry?: LearningEntry; onClose: () => void }) {
  const courses = useWorkspace((s) => s.courses)
  const tasks = useWorkspace((s) => s.tasks)
  const saveItem = useWorkspace((s) => s.saveJournalItem)
  const [id] = useState(() => entry?.item.id ?? newId("lrn"))
  const [courseId, setCourseId] = useState(() => entry?.item.courseId ?? initialCourse ?? tasks.find((t) => t.id === initialTask)?.courseId ?? "")
  const [taskId, setTaskId] = useState(() => entry?.item.taskId ?? initialTask ?? "")
  const [answers, setAnswers] = useState<LearningAnswers>(() => entry ? readLearningReflection(entry.item.text) : { clicked: "", fuzzy: "", next: "", notes: "" })
  const work = tasks.filter((t) => t.courseId === courseId && t.kind !== "event")
  const ok = (courseId || taskId) && hasLearningAnswers(answers)
  const save = () => {
    if (!ok) return
    const now = new Date().toISOString()
    const day = entry?.day ?? todayKey()
    saveItem(day, { id, text: writeLearningReflection(answers), createdAt: entry?.item.createdAt ?? now, updatedAt: now, courseId: courseId || undefined, taskId: taskId || undefined })
    if (!useWorkspace.getState().journal.find((j) => j.id === day)?.entries?.some((i) => i.id === id)) return void toast.error("Couldn't save. Your answers are still here.")
    toast.success("Reflection saved")
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Learning reflection</DialogTitle>
        <DialogDescription>A word or a short answer is enough. Every question is optional.</DialogDescription>
        <div className="grid max-h-[60vh] gap-3.5 overflow-y-auto pr-1">
          <div className="grid gap-1.5"><p className="text-[13px] font-semibold text-ink">Linked learning item</p>
            <div className="flex flex-wrap gap-1.5">{courses.map((c) => <Choice key={c.id} on={courseId === c.id} onClick={() => { setCourseId(c.id); setTaskId("") }}>{c.title}</Choice>)}</div></div>
          {courseId && <div className="grid gap-1.5"><p className="text-[13px] font-semibold text-ink">Assignment or step (optional)</p>
            <div className="flex flex-wrap gap-1.5"><Choice on={!taskId} onClick={() => setTaskId("")}>Whole item</Choice>{work.map((t) => <Choice key={t.id} on={taskId === t.id} onClick={() => setTaskId(t.id)}>{t.title}</Choice>)}</div></div>}
          {LEARNING_PROMPTS.map(([key, label]) => <label key={key} className="grid gap-1.5 text-[13px] font-semibold text-ink">{label}<input value={answers[key]} onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))} placeholder="A word or short phrase" className="h-9 rounded-md border border-line bg-well px-2.5 text-[13px] font-normal outline-none focus:border-[var(--bw-blue)]" /></label>)}
          <label className="grid gap-1.5 text-[13px] font-semibold text-ink">Anything else? (optional)<Textarea rows={4} value={answers.notes} onChange={(e) => setAnswers((a) => ({ ...a, notes: e.target.value }))} placeholder="Write as much or as little as you like…" className="font-normal" /></label>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!ok} onClick={save}>Save reflection</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
