import type {
  CheckFailure,
  DevelopmentService,
  IssueSummary,
  PullRequestSummary,
  RepoActivity,
} from "./types"

/**
 * Demo GitHub adapter. Returns sample review requests, failed checks, issues
 * and activity for whichever repositories are tracked locally. Nothing here
 * comes from GitHub. A real adapter must run behind a server-side boundary
 * that holds the token (never in browser code or localStorage).
 */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

/** Repos the sample data is written against; untracked repos are filtered out. */
const SAMPLE_PRS: PullRequestSummary[] = [
  { id: "pr1", repo: "bcndlabs/website", number: 42, title: "Add project index page", author: "contributor-a", updatedAt: minutesAgo(50), kind: "review-requested", checks: "passing" },
  { id: "pr2", repo: "bcndlabs/blackwall-admin", number: 7, title: "Navigation rail flyout", author: "you", updatedAt: minutesAgo(15), kind: "authored", checks: "pending" },
  { id: "pr3", repo: "bcndlabs/website", number: 40, title: "Update dependencies", author: "dependabot", updatedAt: minutesAgo(60 * 9), kind: "review-requested", checks: "failing" },
]

const SAMPLE_FAILURES: CheckFailure[] = [
  { id: "cf1", repo: "bcndlabs/website", branch: "deps/update-2026-10", workflow: "build", commit: "9f3c2a1", failedAt: minutesAgo(60 * 9) },
  { id: "cf2", repo: "bcndlabs/blackwall-admin", branch: "main", workflow: "lint", commit: "a2e8e40", failedAt: minutesAgo(60 * 26) },
]

const SAMPLE_ISSUES: IssueSummary[] = [
  { id: "is1", repo: "bcndlabs/website", number: 38, title: "Contact form rejects valid emails on iOS", labels: ["bug"], updatedAt: minutesAgo(60 * 3) },
  { id: "is2", repo: "bcndlabs/blackwall-admin", number: 3, title: "Decide analytics provider", labels: ["question"], updatedAt: minutesAgo(60 * 30) },
  { id: "is3", repo: "bcndlabs/website", number: 35, title: "Dark mode contrast on code blocks", labels: ["design"], updatedAt: minutesAgo(60 * 50) },
]

const SAMPLE_ACTIVITY: RepoActivity[] = [
  { id: "ac1", repo: "bcndlabs/blackwall-admin", kind: "push", summary: "3 commits to main", actor: "you", at: minutesAgo(40) },
  { id: "ac2", repo: "bcndlabs/website", kind: "merge", summary: "Merged #41 Fix footer links", actor: "you", at: minutesAgo(60 * 5) },
  { id: "ac3", repo: "bcndlabs/website", kind: "issue", summary: "Opened #38 Contact form rejects valid emails", actor: "visitor", at: minutesAgo(60 * 7) },
  { id: "ac4", repo: "bcndlabs/website", kind: "release", summary: "Released v1.4.0", actor: "you", at: minutesAgo(60 * 28) },
]

const forRepos = <T extends { repo: string }>(items: T[], repos: string[]) => {
  const set = new Set(repos.map((r) => r.toLowerCase()))
  return items.filter((i) => set.has(i.repo.toLowerCase()))
}

export const demoGitHub: DevelopmentService = {
  source: { status: "demo", provider: "Sample GitHub activity" },
  async getPullRequests(repos) {
    return forRepos(SAMPLE_PRS, repos)
  },
  async getFailedChecks(repos) {
    return forRepos(SAMPLE_FAILURES, repos)
  },
  async getIssues(repos) {
    return forRepos(SAMPLE_ISSUES, repos)
  },
  async getActivity(repos) {
    return forRepos(SAMPLE_ACTIVITY, repos)
  },
}
