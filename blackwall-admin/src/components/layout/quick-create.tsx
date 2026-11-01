import {
  FilePlus2,
  FolderPlus,
  GitBranchPlus,
  ListPlus,
  NotebookPen,
  PenLine,
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
import { logHref } from "@/features/journal/daily-log-page"
import { todayKey } from "@/lib/dates"
import { useUi } from "@/stores/ui"

export function QuickCreate() {
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg" aria-label="Create new">
          + <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="bw-label">Create</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openForm({ kind: "task" })}>
          <ListPlus /> Task
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(logHref(todayKey()))}>
          <PenLine /> Today's log
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
