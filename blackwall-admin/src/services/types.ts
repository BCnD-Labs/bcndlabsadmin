import type { DateKey } from "@/lib/types"

/**
 * Typed seams for external data. Each integration is consumed only through
 * one of these interfaces, so a demo adapter can later be swapped for a real
 * one (served from a server-side boundary that holds credentials) without
 * touching UI code.
 */

/** Where a piece of data comes from. Shown on every panel via <SourceBadge>. */
export type SourceStatus = "local" | "demo" | "not-connected"

export interface SourceInfo {
  status: SourceStatus
  /** Human label for the provider, e.g. "Sample generator". */
  provider: string
}

export type TrafficRange = 7 | 30 | 90

export interface TrafficPoint {
  date: DateKey
  visitors: number
  pageviews: number
}

export interface PageStat {
  path: string
  pageviews: number
  visitors: number
}

export interface ReferrerStat {
  source: string
  visitors: number
}

export interface AnalyticsService {
  readonly source: SourceInfo
  getTraffic(range: TrafficRange): Promise<TrafficPoint[]>
  getTopPages(range: TrafficRange): Promise<PageStat[]>
  getReferrers(range: TrafficRange): Promise<ReferrerStat[]>
}

export interface PullRequestSummary {
  id: string
  repo: string
  number: number
  title: string
  author: string
  /** ISO timestamp */
  updatedAt: string
  kind: "review-requested" | "authored"
  checks: "passing" | "failing" | "pending"
}

export interface CheckFailure {
  id: string
  repo: string
  branch: string
  workflow: string
  commit: string
  failedAt: string
}

export interface IssueSummary {
  id: string
  repo: string
  number: number
  title: string
  labels: string[]
  updatedAt: string
}

export interface RepoActivity {
  id: string
  repo: string
  kind: "push" | "merge" | "release" | "issue"
  summary: string
  actor: string
  at: string
}

export interface DevelopmentService {
  readonly source: SourceInfo
  /** `repos` are `owner/name` values from the locally tracked repository links. */
  getPullRequests(repos: string[]): Promise<PullRequestSummary[]>
  getFailedChecks(repos: string[]): Promise<CheckFailure[]>
  getIssues(repos: string[]): Promise<IssueSummary[]>
  getActivity(repos: string[]): Promise<RepoActivity[]>
}

export interface ExternalEvent {
  id: string
  title: string
  start: string
  end?: string
  calendar: string
}

/** Provider-agnostic; no calendar provider is assumed. */
export interface CalendarService {
  readonly source: SourceInfo
  listEvents(from: DateKey, to: DateKey): Promise<ExternalEvent[]>
}
