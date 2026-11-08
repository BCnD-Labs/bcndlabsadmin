import { Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Course, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"

/** The module(s) a piece of work belongs to; tap to move it. Only shown for courses that have modules. */
export function ModuleChip({ task, course }: { task: Task; course?: Course }) {
  const update = useWorkspace((s) => s.update)
  const modules = course?.topics ?? []
  if (!course || !modules.length || task.kind === "event" || task.learningType === "event") return null
  const chosen = modules.filter((m) => task.topicIds?.includes(m.id))
  const label = chosen.length === 0 ? "+ Module" : chosen.length === 1 ? chosen[0].title : `${chosen[0].title} +${chosen.length - 1}`
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...(task.topicIds ?? []), id] : (task.topicIds ?? []).filter((x) => x !== id)
    update("tasks", task.id, { topicIds: next.length ? next : undefined })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="xs" aria-label={`Module of ${task.title}: ${chosen.length ? chosen.map((m) => m.title).join(", ") : "none"}`} className={cn("h-5 max-w-[11rem] gap-1 rounded-full px-2 text-[10px]", chosen.length ? "text-ink-2" : "text-faint")} onClick={(e) => e.stopPropagation()}>
          <Layers className="size-2.5 shrink-0" aria-hidden /><span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="bw-label">Module</DropdownMenuLabel>
        {modules.map((m) => <DropdownMenuCheckboxItem key={m.id} checked={!!task.topicIds?.includes(m.id)} onCheckedChange={(on) => toggle(m.id, on === true)} onSelect={(e) => e.preventDefault()}>{m.title}</DropdownMenuCheckboxItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
