import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { AnalyticsPage } from "@/features/analytics/analytics-page"
import { ContentList } from "@/features/content/content-list"
import { DraftEditor } from "@/features/content/draft-editor"
import { MediaPage } from "@/features/content/media-page"
import { DeploymentsPage } from "@/features/development/deployments-page"
import { ReposPage } from "@/features/development/repos-page"
import { ReviewsPage } from "@/features/development/reviews-page"
import { HomePage } from "@/features/home/home-page"
import { DailyLogPage } from "@/features/journal/daily-log-page"
import { NotesPage } from "@/features/notes/notes-page"
import { ConnectionsPage } from "@/features/settings/connections-page"
import { GeneralSettings } from "@/features/settings/general-page"
import { ServerSettings } from "@/features/settings/server-page"
import { AppearanceSettings, NavigationSettings } from "@/features/settings/settings-pages"
import { ProjectDetail } from "@/features/work/project-detail"
import { ProjectsPage } from "@/features/work/projects-page"
import { TasksPage } from "@/features/work/tasks-page"
import { EmptyState } from "@/components/common/panel"
import { RouteError } from "@/components/layout/route-error"

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "work", element: <Navigate to="/work/tasks" replace /> },
      { path: "work/tasks", element: <TasksPage /> },
      { path: "work/projects", element: <ProjectsPage /> },
      { path: "work/projects/:id", element: <ProjectDetail /> },
      { path: "work/calendar", element: <DailyLogPage /> },
      { path: "work/calendar/:date", element: <DailyLogPage /> },
      { path: "development", element: <Navigate to="/development/repositories" replace /> },
      { path: "development/repositories", element: <ReposPage /> },
      { path: "development/reviews", element: <ReviewsPage /> },
      { path: "development/deployments", element: <DeploymentsPage /> },
      { path: "content", element: <Navigate to="/content/posts" replace /> },
      { path: "content/posts", element: <ContentList mode="all" /> },
      { path: "content/drafts", element: <ContentList mode="drafts" /> },
      { path: "content/drafts/:id", element: <DraftEditor /> },
      { path: "content/media", element: <MediaPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "knowledge/*", element: <Navigate to="/notes" replace /> },
      { path: "settings", element: <Navigate to="/settings/general" replace /> },
      { path: "settings/general", element: <GeneralSettings /> },
      { path: "settings/appearance", element: <AppearanceSettings /> },
      { path: "settings/navigation", element: <NavigationSettings /> },
      { path: "settings/connections", element: <ConnectionsPage /> },
      { path: "settings/server", element: <ServerSettings /> },
      { path: "settings/integrations", element: <Navigate to="/settings/connections" replace /> },
      { path: "*", element: <EmptyState>That page doesn't exist.</EmptyState> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
