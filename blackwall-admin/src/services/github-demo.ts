import type { DevelopmentOverview } from "./types"

/**
 * Sample development data, shown only when "Show sample data" is on and
 * GitHub isn't connected. Items are attached to your tracked repositories so
 * the layout can be previewed; none of it comes from GitHub.
 */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export function sampleDevelopment(repos: string[]): DevelopmentOverview {
  const [a = "example/website", b = a] = repos
  return {
    prs: [
      { id: "s-pr1", repo: a, number: 42, title: "Add project index page", author: "collaborator", updatedAt: minutesAgo(50), kind: "review-requested", checks: "passing" },
      { id: "s-pr2", repo: a, number: 40, title: "Update dependencies", author: "dependabot", updatedAt: minutesAgo(540), kind: "review-requested", checks: "failing" },
      { id: "s-pr3", repo: b, number: 7, title: "Navigation improvements", author: "you", updatedAt: minutesAgo(15), kind: "authored", checks: "pending" },
    ],
    failures: [{ id: "s-cf1", repo: a, branch: "deps/update", workflow: "build", commit: "9f3c2a1", failedAt: minutesAgo(540) }],
    issues: [
      { id: "s-is1", repo: a, number: 38, title: "Contact form rejects valid emails on iOS", labels: ["bug"], updatedAt: minutesAgo(180) },
      { id: "s-is2", repo: b, number: 3, title: "Dark mode contrast on code blocks", labels: ["design"], updatedAt: minutesAgo(1800) },
    ],
    activity: [
      { id: "s-ac1", repo: b, kind: "push", summary: "3 commits to main", actor: "you", at: minutesAgo(40) },
      { id: "s-ac2", repo: a, kind: "merge", summary: "Merged #41 Fix footer links", actor: "you", at: minutesAgo(300) },
      { id: "s-ac3", repo: a, kind: "release", summary: "Released v1.4.0", actor: "you", at: minutesAgo(1680) },
    ],
  }
}
