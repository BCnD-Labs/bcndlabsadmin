import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Course, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { setTaskStatus } from "@shared/records"
import { WORK_STATUSES, statusLabel, statusOf } from "@shared/learning"

/** Classes track assignments, exams and milestones through not started, in progress, submitted and graded. */
export const tracksStatus = (task: Task, course?: Course) => (course?.kind ?? "course") === "course" && task.kind !== "event" && task.learningType !== "event"

export function StatusPill({ task }: { task: Task }) {
  const status = statusOf(task)
  const set = (value: typeof status) => useWorkspace.setState((s) => setTaskStatus({ tasks: s.tasks }, task.id, value))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="xs" aria-label={`Status of ${task.title}: ${statusLabel(status)}`} className={cn("h-5 gap-0.5 rounded-full px-2 text-[10px]", status === "in_progress" && "text-[var(--bw-blue,#64b5f6)]", (status === "submitted" || status === "graded") && "text-green", status === "not_started" && "text-muted-foreground")}>
          {statusLabel(status)} <ChevronDown className="size-2.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {WORK_STATUSES.map((x) => <DropdownMenuItem key={x.value} onSelect={() => set(x.value)} className={cn(x.value === status && "text-ink")}>{x.label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
