import { format } from "date-fns"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { parseKey } from "@/lib/dates"
import type { Course, CourseTopic, Task } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"

/**
 * Put several pieces of work into a module at once, grouped by due date: "everything due Nov 11" is one tick.
 * Work already in another module is shown with that module's name and moves only if you tick it.
 */
export function AddWorkDialog({ course, module, onClose }: { course: Course; module: CourseTopic; onClose: () => void }) {
  const tasks = useWorkspace((s) => s.tasks)
  const update = useWorkspace((s) => s.update)
  const candidates = tasks.filter((t) => t.courseId === course.id && t.kind !== "event" && t.learningType !== "event" && !t.topicIds?.includes(module.id))
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const groups = new Map<string, Task[]>()
  for (const t of [...candidates].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.title.localeCompare(b.title))) groups.set(t.due ?? "", [...(groups.get(t.due ?? "") ?? []), t])
  const moduleName = (t: Task) => (t.topicIds?.length ? course.topics?.find((m) => m.id === t.topicIds![0])?.title : undefined)
  const flip = (ids: string[], on: boolean) => setPicked((s) => { const n = new Set(s); for (const id of ids) { if (on) n.add(id); else n.delete(id) } return n })
  const apply = () => {
    for (const id of picked) {
      const t = tasks.find((x) => x.id === id)
      if (t) update("tasks", id, { topicIds: [...new Set([...(t.topicIds ?? []).filter((m) => !(course.topics ?? []).some((c) => c.id === m)), module.id])] })
    }
    toast.success(`${picked.size} item${picked.size === 1 ? "" : "s"} added to ${module.title}`)
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Add work to {module.title}</DialogTitle>
        <DialogDescription>Tick a date to take everything due that day, or pick items one by one. Work in another module moves here.</DialogDescription>
        {candidates.length ? (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1" data-testid="add-work">
            {[...groups].map(([due, rows]) => {
              const all = rows.every((t) => picked.has(t.id))
              return (
                <section key={due || "none"} aria-label={due || "No date"}>
                  <label className="flex items-center gap-2 border-b border-line-soft pb-1 text-[12px] font-semibold text-ink">
                    <Checkbox checked={all} onCheckedChange={(on) => flip(rows.map((t) => t.id), on === true)} aria-label={`Everything due ${due || "with no date"}`} />
                    {due ? format(parseKey(due), "EEE, MMM d") : "No date"} <span className="font-normal text-faint">· {rows.length}</span>
                  </label>
                  <ul>{rows.map((t) => (
                    <li key={t.id}><label className="flex min-h-9 items-center gap-2 py-1 pl-6 text-[13px] text-ink-2">
                      <Checkbox checked={picked.has(t.id)} onCheckedChange={(on) => flip([t.id], on === true)} aria-label={t.title} />
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {moduleName(t) && <span className="shrink-0 text-[11px] text-faint">in {moduleName(t)}</span>}
                    </label></li>
                  ))}</ul>
                </section>
              )
            })}
          </div>
        ) : <p className="py-3 text-sm text-muted-foreground">Everything in this course is already in {module.title}.</p>}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!picked.size} onClick={apply}>Add {picked.size || ""} to module</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
