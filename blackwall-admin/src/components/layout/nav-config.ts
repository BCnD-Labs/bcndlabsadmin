import { Code2, FileText, Home, ListChecks, type LucideIcon } from "lucide-react"
import { CMS, PRODUCTIVITY, calendarHref, draftsHref, insightsHref, learningHref, notesHref, projectsHref, siteAnalyticsHref, tasksHref } from "@/lib/routes"

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
    id: "productivity",
    label: "Productivity",
    icon: ListChecks,
    to: tasksHref,
    match: PRODUCTIVITY,
    children: [
      { label: "Tasks", to: tasksHref },
      { label: "Projects", to: projectsHref },
      { label: "Learning", to: learningHref },
      { label: "Calendar & daily log", to: calendarHref },
      { label: "Notes", to: notesHref },
      { label: "Insights", to: insightsHref },
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
    id: "cms",
    label: "CMS",
    icon: FileText,
    to: `${CMS}/posts`,
    match: CMS,
    children: [
      { label: "Pages & posts", to: `${CMS}/posts` },
      { label: "Drafts", to: draftsHref },
      { label: "Media", to: `${CMS}/media` },
      { label: "Site analytics", to: siteAnalyticsHref },
    ],
  },
]

export function isActive(dest: NavDestination, pathname: string) {
  return dest.match === "/" ? pathname === "/" : pathname.startsWith(dest.match)
}
