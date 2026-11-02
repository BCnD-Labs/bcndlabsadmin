import { Code2, FileText, Home, ListChecks, type LucideIcon } from "lucide-react"
import { CMS, DEVELOPMENT, PRODUCTIVITY, insightsHref, learningHref, mediaHref, plannerHref, postsHref, projectsHref, siteAnalyticsHref } from "@/lib/routes"

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
    to: plannerHref,
    match: PRODUCTIVITY,
    children: [
      { label: "Planner", to: plannerHref },
      { label: "Projects", to: projectsHref },
      { label: "Learning", to: learningHref },
      { label: "Insights", to: insightsHref },
    ],
  },
  {
    id: "development",
    label: "Development",
    icon: Code2,
    to: DEVELOPMENT,
    match: DEVELOPMENT,
  },
  {
    id: "cms",
    label: "CMS",
    icon: FileText,
    to: postsHref,
    match: CMS,
    children: [
      { label: "Posts & pages", to: postsHref },
      { label: "Media", to: mediaHref },
      { label: "Site analytics", to: siteAnalyticsHref },
    ],
  },
]

export function isActive(dest: NavDestination, pathname: string) {
  return dest.match === "/" ? pathname === "/" : pathname.startsWith(dest.match)
}

/** The sub-page you're on: an exact match, else the longest prefix (so /productivity/projects isn't the Planner at /productivity). */
export function activeChild(dest: NavDestination, pathname: string, search = ""): NavChild | undefined {
  return (
    dest.children?.find((c) => pathname + search === c.to) ??
    dest.children
      ?.filter((c) => !c.to.includes("?") && (pathname === c.to || pathname.startsWith(c.to + "/")))
      .sort((a, b) => b.to.length - a.to.length)[0]
  )
}
