import {
  FilePlus2,
  ClipboardList,
  FolderPlus,
  GitBranchPlus,
  GraduationCap,
  ListPlus,
  NotebookPen,
  StickyNote,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { logHref } from "@/lib/routes"
import { todayKey } from "@/lib/dates"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { draftHref } from "@/lib/routes"

export function QuickCreate({ quiet = false }: { quiet?: boolean }) {
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const navigate = useNavigate()
  // New assignments default to the most recently added course.
  const firstCourse = useWorkspace((s) => s.courses[0]?.id)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg" variant={quiet ? "ghost" : "default"} aria-label="Create new">
          + <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="bw-label">Create</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openForm({ kind: "task" })}>
          <ListPlus /> Task
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(logHref(todayKey()))}>
          <NotebookPen /> Today's log
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "note" })}>
          <StickyNote /> Note
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openForm({ kind: "task", defaults: { courseId: firstCourse, learningType: "assignment" } })} disabled={!firstCourse}>
          <ClipboardList /> Assignment
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "course" })}>
          <GraduationCap /> Course
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(draftHref(createDraft().id))}>
          <FilePlus2 /> Post draft
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "project" })}>
          <FolderPlus /> Project
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "repo" })}>
          <GitBranchPlus /> Repository link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
