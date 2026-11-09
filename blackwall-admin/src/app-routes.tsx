import { createBrowserRouter, Navigate, useLocation, useParams, type RouteObject } from "react-router-dom"
import type { ReactNode } from "react"
import { InsightsPage, SiteAnalyticsPage } from "@/features/analytics/analytics-page"
import { PostEditor } from "@/features/content/post-editor"
import { MediaPage } from "@/features/content/media-page"
import { CmsSitesPage } from "@/features/cms/sites-page"
import { CmsPostsRoute } from "@/features/cms/posts-panel"
import { AssetsPage } from "@/features/assets/assets-page"
import { SiteWorkspace } from "@/features/cms/site-workspace"
import { SocialPage } from "@/features/social/social-page"
import { SocialPostPage } from "@/features/social/social-post"
import { DevelopmentPage } from "@/features/development/development-page"
import { HomePage } from "@/features/home/home-page"
import { CourseDetail } from "@/features/learning/course-detail"
import { LearningPage } from "@/features/learning/learning-page"
import { JournalPage } from "@/features/journal/journal-page"
import { SettingsRoute } from "@/features/settings/settings-route"
import { ProjectDetail } from "@/features/work/project-detail"
import { ProjectsPage } from "@/features/work/projects-page"
import { PlannerPage } from "@/features/productivity/planner-page"
import { LauncherPage } from "@/features/mikoshi/launcher-page"
import { MikoshiStatusPage } from "@/features/mikoshi/upcoming-pages"
import { MikoshiStoragePage } from "@/features/mikoshi/storage-page"
import { NotFound } from "@/components/layout/not-found"
import { RouteError } from "@/components/layout/route-error"

/** Old URLs (Work, Content, Notes, Analytics) keep working: swap the prefix, keep the rest and the query. */
function Moved({ from, to }: { from: string; to: string }) {
  const { pathname, search } = useLocation()
  return <Navigate to={to + pathname.slice(from.length) + search} replace />
}

/** The old Tasks, Notes and Calendar pages are the Planner now; a day or note in the old URL carries over. */
function ToPlanner({ section }: { section?: "notes" | "day" }) {
  const { search } = useLocation()
  const { date } = useParams()
  const old = new URLSearchParams(search)
  const next = new URLSearchParams()
  if (date) next.set("date", date)
  if (old.get("id")) next.set("note", old.get("id")!)
  const q = next.toString()
  return <Navigate to={`/productivity${q ? `?${q}` : ""}${section ? `#${section}` : ""}`} replace />
}

/** /analytics?view=website was the website tab; everything else was the personal view. */
function MovedAnalytics() {
  const { search } = useLocation()
  return <Navigate to={new URLSearchParams(search).get("view") === "website" ? "/cms/analytics" : "/productivity/insights"} replace />
}

/** Shared page map also lets each Mac desktop window retain its own route. */
export const blackwallPages: RouteObject[] = [
      { index: true, element: <HomePage /> },
      { path: "journal", element: <JournalPage /> },
      { path: "productivity", element: <PlannerPage /> },
      { path: "productivity/tasks", element: <ToPlanner /> },
      { path: "productivity/projects", element: <ProjectsPage /> },
      { path: "productivity/projects/:id", element: <ProjectDetail /> },
      { path: "productivity/learning", element: <LearningPage /> },
      { path: "productivity/learning/:id", element: <CourseDetail /> },
      { path: "productivity/calendar", element: <ToPlanner section="day" /> },
      { path: "productivity/calendar/:date", element: <ToPlanner section="day" /> },
      { path: "productivity/notes", element: <ToPlanner section="notes" /> },
      { path: "productivity/insights", element: <InsightsPage /> },
      { path: "development", element: <DevelopmentPage /> },
      { path: "development/*", element: <Navigate to="/development" replace /> },
      { path: "cms", element: <CmsSitesPage /> },
      { path: "cms/pages", element: <SiteWorkspace /> },
      { path: "cms/posts", element: <CmsPostsRoute /> },
      { path: "cms/pages/:id", element: <SiteWorkspace /> },
      // The old tabs are panels of the workspace now.
      { path: "cms/forms", element: <Navigate to="/cms/pages?panel=forms" replace /> },
      { path: "cms/settings", element: <Navigate to="/cms/pages?panel=settings" replace /> },
      { path: "cms/look", element: <Navigate to="/cms/pages?panel=look" replace /> },
      { path: "cms/files", element: <Navigate to="/cms/pages?panel=files" replace /> },
      { path: "cms/assets", element: <Navigate to="/assets" replace /> },
      { path: "assets", element: <AssetsPage /> },
      { path: "cms/posts/:id", element: <PostEditor /> },
      { path: "cms/drafts", element: <Navigate to="/cms/posts?show=drafts" replace /> },
      { path: "cms/drafts/:id", element: <Moved from="/cms/drafts" to="/cms/posts" /> },
      { path: "cms/media", element: <MediaPage /> },
      { path: "cms/analytics", element: <SiteAnalyticsPage /> },
      { path: "social", element: <SocialPage /> },
      { path: "social/:id", element: <SocialPostPage /> },
      { path: "mikoshi", element: <LauncherPage /> },
      { path: "mikoshi/status", element: <MikoshiStatusPage /> },
      { path: "mikoshi/storage", element: <MikoshiStoragePage /> },
      // Old addresses (bookmarks, links in notes).
      { path: "work/*", element: <Moved from="/work" to="/productivity" /> },
      { path: "work", element: <Navigate to="/productivity" replace /> },
      { path: "content/*", element: <Moved from="/content" to="/cms" /> },
      { path: "notes", element: <ToPlanner section="notes" /> },
      { path: "knowledge/*", element: <ToPlanner section="notes" /> },
      { path: "analytics", element: <MovedAnalytics /> },
      { path: "settings", element: <SettingsRoute /> },
      { path: "settings/:section", element: <SettingsRoute /> },
      { path: "*", element: <NotFound /> },
]

export function createBlackwallRouter(shell: ReactNode) {
  return createBrowserRouter([{ element: shell, errorElement: <RouteError />, children: blackwallPages }])
}
