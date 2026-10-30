import {
  BarChart3,
  BookOpen,
  Briefcase,
  Code2,
  FileText,
  Home,
  Settings,
  type LucideIcon,
} from "lucide-react"

export interface NavChild {
  label: string
  to: string
}

export interface NavDestination {
  id: string
  label: string
  icon: LucideIcon
  /** Where selecting the destination itself navigates. */
  to: string
  /** Route prefix that marks this destination active. */
  match: string
  children?: NavChild[]
}

export const NAV: NavDestination[] = [
  { id: "home", label: "Home", icon: Home, to: "/", match: "/" },
  {
    id: "work",
    label: "Work",
    icon: Briefcase,
    to: "/work/tasks",
    match: "/work",
    children: [
      { label: "Tasks", to: "/work/tasks" },
      { label: "Projects", to: "/work/projects" },
      { label: "Calendar", to: "/work/calendar" },
    ],
  },
  {
    id: "development",
    label: "Development",
    icon: Code2,
    to: "/development/repositories",
    match: "/development",
    children: [
      { label: "Repositories", to: "/development/repositories" },
      { label: "Reviews & issues", to: "/development/reviews" },
      { label: "Deployment links", to: "/development/deployments" },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: FileText,
    to: "/content/posts",
    match: "/content",
    children: [
      { label: "Pages & posts", to: "/content/posts" },
      { label: "Drafts", to: "/content/drafts" },
      { label: "Media", to: "/content/media" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    to: "/analytics",
    match: "/analytics",
    children: [{ label: "Website traffic", to: "/analytics" }],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: BookOpen,
    to: "/knowledge/notes",
    match: "/knowledge",
    children: [
      { label: "Notes", to: "/knowledge/notes" },
      { label: "References", to: "/knowledge/references" },
      { label: "Links", to: "/knowledge/links" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    to: "/settings/appearance",
    match: "/settings",
    children: [
      { label: "Appearance", to: "/settings/appearance" },
      { label: "Navigation", to: "/settings/navigation" },
      { label: "Integrations", to: "/settings/integrations" },
    ],
  },
]

export function isActive(dest: NavDestination, pathname: string) {
  return dest.match === "/" ? pathname === "/" : pathname.startsWith(dest.match)
}
