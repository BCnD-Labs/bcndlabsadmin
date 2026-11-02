import { addDays } from "date-fns"
import { toDateKey } from "@/lib/dates"
import { mulberry32 } from "./prng"
import type { DevelopmentOverview, RepoSummary } from "./types"

/** Made-up commit history: busier on weekdays, quieter further back. */
function history(seed: number, rate: number): Record<string, number> {
  const rand = mulberry32(seed)
  const out: Record<string, number> = {}
  for (let i = 0; i < 26 * 7; i++) {
    const day = addDays(new Date(), -i)
    const weekend = day.getDay() === 0 || day.getDay() === 6
    const n = Math.floor(rand() * rate * (weekend ? 0.4 : 1) * (1 - i / 260))
    if (n > 0) out[toDateKey(day)] = n
  }
  return out
}

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
      { id: "s-ac1", repo: b, kind: "commit", summary: "Planner: tasks under the calendar", actor: "you", sha: "46e36f3", at: minutesAgo(40) },
      { id: "s-ac4", repo: b, kind: "commit", summary: "Development: commit history and languages", actor: "you", sha: "2c342a1", at: minutesAgo(190) },
      { id: "s-ac2", repo: a, kind: "merge", summary: "Merged #41 Fix footer links", actor: "you", at: minutesAgo(300) },
      { id: "s-ac5", repo: a, kind: "commit", summary: "Blog: week 10 gallery", actor: "you", sha: "9f3c2a1", at: minutesAgo(1500) },
      { id: "s-ac3", repo: a, kind: "release", summary: "Released v1.4.0", actor: "you", at: minutesAgo(1680) },
    ],
    repos: repos.map(
      (r, i): RepoSummary => ({
        repo: r,
        description: i === 0 ? "The public website." : "Personal workspace dashboard.",
        private: i !== 0,
        defaultBranch: "main",
        stars: i === 0 ? 3 : 0,
        pushedAt: minutesAgo(40 + i * 200),
        languages: i === 0 ? [{ name: "HTML", bytes: 52000 }, { name: "CSS", bytes: 31000 }, { name: "JavaScript", bytes: 4000 }] : [{ name: "TypeScript", bytes: 410000 }, { name: "CSS", bytes: 14000 }, { name: "Shell", bytes: 6000 }, { name: "Dockerfile", bytes: 2000 }],
        commitsByDay: history(7 + i, i === 0 ? 2.2 : 4),
      }),
    ),
  }
}
