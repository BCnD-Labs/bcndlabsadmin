import { createBrowserRouter, Navigate, RouterProvider, useLocation } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { InsightsPage, SiteAnalyticsPage } from "@/features/analytics/analytics-page"
import { ContentList } from "@/features/content/content-list"
import { DraftEditor } from "@/features/content/draft-editor"
import { MediaPage } from "@/features/content/media-page"
import { DeploymentsPage } from "@/features/development/deployments-page"
import { ReposPage } from "@/features/development/repos-page"
import { ReviewsPage } from "@/features/development/reviews-page"
import { HomePage } from "@/features/home/home-page"
import { DailyLogPage } from "@/features/journal/daily-log-page"
import { CourseDetail } from "@/features/learning/course-detail"
import { LearningPage } from "@/features/learning/learning-page"
import { NotesPage } from "@/features/notes/notes-page"
import { SettingsRoute } from "@/features/settings/settings-route"
import { ProjectDetail } from "@/features/work/project-detail"
import { ProjectsPage } from "@/features/work/projects-page"
import { TasksPage } from "@/features/work/tasks-page"
import { NotFound } from "@/components/layout/not-found"
import { RouteError } from "@/components/layout/route-error"

/** Old URLs (Work, Content, Notes, Analytics) keep working: swap the prefix, keep the rest and the query. */
function Moved({ from, to }: { from: string; to: string }) {
  const { pathname, search } = useLocation()
  return <Navigate to={to + pathname.slice(from.length) + search} replace />
}

/** /analytics?view=website was the website tab; everything else was the personal view. */
function MovedAnalytics() {
  const { search } = useLocation()
  return <Navigate to={new URLSearchParams(search).get("view") === "website" ? "/cms/analytics" : "/productivity/insights"} replace />
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "productivity", element: <Navigate to="/productivity/tasks" replace /> },
      { path: "productivity/tasks", element: <TasksPage /> },
      { path: "productivity/projects", element: <ProjectsPage /> },
      { path: "productivity/projects/:id", element: <ProjectDetail /> },
      { path: "productivity/learning", element: <LearningPage /> },
      { path: "productivity/learning/:id", element: <CourseDetail /> },
      { path: "productivity/calendar", element: <DailyLogPage /> },
      { path: "productivity/calendar/:date", element: <DailyLogPage /> },
      { path: "productivity/notes", element: <NotesPage /> },
      { path: "productivity/insights", element: <InsightsPage /> },
      { path: "development", element: <Navigate to="/development/repositories" replace /> },
      { path: "development/repositories", element: <ReposPage /> },
      { path: "development/reviews", element: <ReviewsPage /> },
      { path: "development/deployments", element: <DeploymentsPage /> },
      { path: "cms", element: <Navigate to="/cms/posts" replace /> },
      { path: "cms/posts", element: <ContentList mode="all" /> },
      { path: "cms/drafts", element: <ContentList mode="drafts" /> },
      { path: "cms/drafts/:id", element: <DraftEditor /> },
      { path: "cms/media", element: <MediaPage /> },
      { path: "cms/analytics", element: <SiteAnalyticsPage /> },
      // Old addresses (bookmarks, links in notes).
      { path: "work/*", element: <Moved from="/work" to="/productivity" /> },
      { path: "work", element: <Navigate to="/productivity/tasks" replace /> },
      { path: "content/*", element: <Moved from="/content" to="/cms" /> },
      { path: "notes", element: <Moved from="/notes" to="/productivity/notes" /> },
      { path: "knowledge/*", element: <Navigate to="/productivity/notes" replace /> },
      { path: "analytics", element: <MovedAnalytics /> },
      { path: "settings", element: <SettingsRoute /> },
      { path: "settings/:section", element: <SettingsRoute /> },
      { path: "*", element: <NotFound /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
