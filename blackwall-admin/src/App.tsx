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
import { KnowledgePage } from "@/features/knowledge/knowledge-page"
import { AppearanceSettings, IntegrationSettings, NavigationSettings } from "@/features/settings/settings-pages"
import { CalendarPage } from "@/features/work/calendar-page"
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
      { path: "work/calendar", element: <CalendarPage /> },
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
      { path: "knowledge", element: <Navigate to="/knowledge/notes" replace /> },
      { path: "knowledge/notes", element: <KnowledgePage key="note" kind="note" /> },
      { path: "knowledge/references", element: <KnowledgePage key="reference" kind="reference" /> },
      { path: "knowledge/links", element: <KnowledgePage key="link" kind="link" /> },
      { path: "settings", element: <Navigate to="/settings/appearance" replace /> },
      { path: "settings/appearance", element: <AppearanceSettings /> },
      { path: "settings/navigation", element: <NavigationSettings /> },
      { path: "settings/integrations", element: <IntegrationSettings /> },
      { path: "*", element: <EmptyState>That page doesn't exist.</EmptyState> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
