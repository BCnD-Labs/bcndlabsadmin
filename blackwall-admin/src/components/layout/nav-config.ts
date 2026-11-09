import { useMemo } from "react"
import type { Category } from "@/components/common/category-icon"
import { usePrefs } from "@/stores/prefs"
import { CMS, DEVELOPMENT, assetsHref, cmsPagesHref, sitesHref, formsHref, siteSettingsHref, MIKOSHI, PRODUCTIVITY, launcherHref, mikoshiStatusHref, mikoshiStorageHref, insightsHref, learningHref, mediaHref, plannerHref, postsHref, projectsHref, siteAnalyticsHref, SOCIAL, socialHref } from "@/lib/routes"

export interface NavChild {
  label: string
  to: string
}

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
      { label: "Learning", to: learningHref },
      { label: "Activity insights", to: insightsHref },
    ],
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
    label: "Websites",
    category: "website",
    to: sitesHref,
    match: CMS,
    children: [
      { label: "All sites", to: sitesHref },
      { label: "Pages", to: cmsPagesHref },
      { label: "Posts", to: postsHref },
      { label: "Forms", to: formsHref },
      { label: "Repo images", to: mediaHref },
      { label: "Traffic", to: siteAnalyticsHref },
      { label: "Site settings", to: siteSettingsHref },
    ],
  },
  { id: "assets", label: "Assets", category: "website", to: assetsHref, match: assetsHref },
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

/** NAV with your own section names (Settings → Sidebar); hidden sections are left out unless asked for. */
export function useNav(includeHidden = false): NavDestination[] {
  const labels = usePrefs((s) => s.navLabels)
  const hidden = usePrefs((s) => s.navHidden)
  return useMemo(
    () => NAV.map((d) => ({ ...d, label: labels[d.id] || d.label })).filter((d) => includeHidden || d.id === "home" || !hidden.includes(d.id)),
    [labels, hidden, includeHidden],
  )
}
