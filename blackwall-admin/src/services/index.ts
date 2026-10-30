import { demoAnalytics } from "./analytics-demo"
import { unconnectedCalendar } from "./calendar"
import { demoGitHub } from "./github-demo"
import type { SourceStatus } from "./types"

/** Swap adapters here when real integrations exist. */
export const services = {
  analytics: demoAnalytics,
  development: demoGitHub,
  calendar: unconnectedCalendar,
}

export interface IntegrationInfo {
  id: string
  name: string
  status: SourceStatus
  serves: string
  contract: string
  current: string
  next: string[]
}

/** Shown on Settings → Integrations. Keep statuses honest. */
export const integrations: IntegrationInfo[] = [
  {
    id: "github",
    name: "GitHub",
    status: services.development.source.status,
    serves: "Development panel, Reviews & issues, repository activity",
    contract: "DevelopmentService",
    current:
      "Sample review requests, failed checks and activity for your tracked repositories. Repository links themselves are local records.",
    next: [
      "Add a small server-side endpoint (e.g. a serverless function) that holds a GitHub token or GitHub App credentials.",
      "Implement DevelopmentService against that endpoint and register it in src/services/index.ts.",
    ],
  },
  {
    id: "analytics",
    name: "Website analytics",
    status: services.analytics.source.status,
    serves: "Home traffic chart, Analytics page",
    contract: "AnalyticsService",
    current:
      "A deterministic sample series. No analytics provider has been chosen, so none is assumed.",
    next: [
      "Choose the provider bcndlabs.com reports to.",
      "Expose its reporting API through a server-side proxy so the API key never reaches the browser.",
      "Implement AnalyticsService (traffic, top pages, referrers) against that proxy.",
    ],
  },
  {
    id: "calendar",
    name: "Calendar",
    status: services.calendar.source.status,
    serves: "Agenda and Work → Calendar (alongside local events)",
    contract: "CalendarService",
    current: "Only local events created in Blackwall are shown.",
    next: [
      "Pick a calendar source (CalDAV, an ICS feed, or a provider API).",
      "Implement CalendarService.listEvents and merge results with local events.",
    ],
  },
  {
    id: "media",
    name: "Media storage",
    status: "not-connected",
    serves: "Content → Media",
    contract: "(to be defined)",
    current: "No media library. Drafts store text only.",
    next: [
      "Decide where website media lives (repository, object storage, or CDN).",
      "Define a MediaService interface for listing and uploading assets via a server boundary.",
    ],
  },
  {
    id: "backend",
    name: "Workspace backend (SQL)",
    status: "not-connected",
    serves: "Persistence for tasks, events, notes, projects, repositories and drafts",
    contract: "stores/workspace.ts actions",
    current:
      "Records are saved in this browser's localStorage (versioned). They do not sync between devices.",
    next: [
      "Stand up the Soulkiller service with an authenticated API.",
      "Back the workspace store's create/update/remove actions with that API; the local schema version provides a migration path.",
    ],
  },
]
