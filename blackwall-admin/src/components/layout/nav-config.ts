import { useMemo } from "react"
import type { Category } from "@/components/common/category-icon"
import type { LearningKind } from "@/lib/types"
import { usePrefs } from "@/stores/prefs"
import { useWorkspace } from "@/stores/workspace"
import { KINDS } from "@/features/learning/learning-utils"
import { activeDestination, learningChildren, matchesRoute, type NavChild } from "./nav-model"
import { CMS, DEVELOPMENT, cmsPagesHref, formsHref, siteSettingsHref, MIKOSHI, PRODUCTIVITY, launcherHref, mikoshiStatusHref, mikoshiStorageHref, insightsHref, learningHref, mediaHref, plannerHref, postsHref, projectsHref, siteAnalyticsHref, SOCIAL, socialHref } from "@/lib/routes"

export type { NavChild }

export interface NavDestination {
  id: string
  label: string
  category: Category
  /** Where selecting the destination itself navigates. */
  to: string
  /** Route prefix that marks this destination active. */
  match: string
  children?: NavChild[]
}

export const NAV: NavDestination[] = [
  { id: "home", label: "Home", category: "home", to: "/", match: "/" },
  {
    id: "productivity",
    label: "Productivity",
    category: "tasks",
    to: plannerHref,
    match: PRODUCTIVITY,
    children: [
      { label: "Planner", to: plannerHref },
      { label: "Projects", to: projectsHref },
      { label: "Activity insights", to: insightsHref },
    ],
  },
  // Its own section; the route stays under /productivity so links and course pages keep working.
  // Children are derived from your records by useNav (Courses always, other kinds once they exist).
  {
    id: "learning",
    label: "Learning",
    category: "learning",
    to: learningHref,
    match: learningHref,
    children: [{ label: "Courses", to: `${learningHref}?kind=course` }],
  },
  {
    id: "development",
    label: "GitHub activity",
    category: "development",
    to: DEVELOPMENT,
    match: DEVELOPMENT,
  },
  {
    id: "cms",
    label: "Website",
    category: "website",
    to: cmsPagesHref,
    match: CMS,
    children: [
      { label: "Pages", to: cmsPagesHref },
      { label: "Posts", to: postsHref },
      { label: "Forms", to: formsHref },
      { label: "Assets", to: mediaHref },
      { label: "Traffic", to: siteAnalyticsHref },
      { label: "Site settings", to: siteSettingsHref },
    ],
  },
  { id: "social", label: "Social", category: "social", to: socialHref, match: SOCIAL },
  {
    id: "mikoshi",
    label: "Mikoshi",
    category: "mikoshi",
    to: launcherHref,
    match: MIKOSHI,
    children: [
      { label: "Launcher", to: launcherHref },
      { label: "Status", to: mikoshiStatusHref },
      { label: "Storage", to: mikoshiStorageHref },
    ],
  },
]

/** Whether `pathname` is under this destination (Productivity also covers Learning's route; see activeIn). */
export function isActive(dest: NavDestination, pathname: string) {
  return matchesRoute(dest.match, pathname)
}

/** The one section you're in: the most specific match, so /productivity/learning is Learning. */
export const activeIn = activeDestination

/** The sub-page you're on: an exact match, else the longest prefix (so /productivity/projects isn't the Planner at /productivity). */
export function activeChild(dest: NavDestination, pathname: string, search = ""): NavChild | undefined {
  return (
    dest.children?.find((c) => pathname + search === c.to) ??
    dest.children
      ?.filter((c) => !c.to.includes("?") && (pathname === c.to || pathname.startsWith(c.to + "/")))
      .sort((a, b) => b.to.length - a.to.length)[0]
  )
}

/**
 * NAV with your own section names (Settings → Sidebar) and Learning's children from your
 * records; hidden sections are left out unless asked for. Every navigation surface (sidebar,
 * rail pop-outs, header tabs, command search, the phone sheet and tab bar) reads this.
 */
export function useNav(includeHidden = false): NavDestination[] {
  const labels = usePrefs((s) => s.navLabels)
  const hidden = usePrefs((s) => s.navHidden)
  // A stable key of which kinds exist, so the nav only changes when that does.
  const kinds = useWorkspace((s) => [...new Set(s.courses.map((c) => c.kind ?? "course"))].sort().join(","))
  return useMemo(() => {
    const learning = learningChildren(kinds ? kinds.split(",").map((kind) => ({ kind: kind as LearningKind })) : [], KINDS)
    return NAV.map((d) => ({ ...d, label: labels[d.id] || d.label, ...(d.id === "learning" ? { children: learning } : {}) }))
      .filter((d) => includeHidden || d.id === "home" || !hidden.includes(d.id))
  }, [labels, hidden, includeHidden, kinds])
}
