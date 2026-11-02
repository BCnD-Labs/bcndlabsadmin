import { BarChart3, CalendarDays, Cloud, FileText, FolderKanban, GitBranch, GraduationCap, LayoutDashboard, ListChecks, NotebookPen, Plug, Shield, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export const CATEGORIES = {
  home: LayoutDashboard,
  tasks: ListChecks,
  learning: GraduationCap,
  calendar: CalendarDays,
  development: GitBranch,
  website: FileText,
  analytics: BarChart3,
  projects: FolderKanban,
  journal: NotebookPen,
  service: Plug,
  azure: Cloud,
  cloudflare: Shield,
} satisfies Record<string, LucideIcon>

export type Category = keyof typeof CATEGORIES

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = CATEGORIES[category]
  return <span data-category={category} className={cn("bw-category-icon inline-flex size-7 shrink-0 items-center justify-center rounded-md", className)} aria-hidden><Icon className="size-4" strokeWidth={1.8} /></span>
}
