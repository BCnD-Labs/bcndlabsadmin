export type {
  AnalyticsReport,
  CheckFailure,
  DevelopmentOverview,
  IssueSummary,
  PageStat,
  PullRequestSummary,
  ReferrerStat,
  RepoActivity,
  RepoSummary,
  TrafficPoint,
} from "@shared/connections"

/** Where a panel's data comes from. Shown via <SourceBadge>. */
export type SourceStatus = "live" | "sample" | "not-connected" | "error" | "loading"

export type TrafficRange = 7 | 30 | 90
