import {
  CalendarPlus,
  FilePlus2,
  FolderPlus,
  GitBranchPlus,
  ListPlus,
  NotebookPen,
  Plus,
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
import { useUi } from "@/stores/ui"

export function QuickCreate() {
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-8 gap-1.5 px-2.5" aria-label="Create new">
          <Plus className="size-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="eyebrow">Create</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openForm({ kind: "task" })}>
          <ListPlus /> Task
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "event" })}>
          <CalendarPlus /> Event
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "note" })}>
          <NotebookPen /> Note
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(`/content/drafts/${createDraft().id}`)}>
          <FilePlus2 /> Content draft
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
