import { addDays } from "date-fns"
import { toDateKey } from "@/lib/dates"
import type { GitHubAccountView } from "@/services/data"
import type { DevelopmentOverview, RepoSummary } from "@/services/types"

/** Every account's slice merged into one overview (a PR found by two searches counts once). */
export function mergeAccounts(accounts: GitHubAccountView[]): DevelopmentOverview | undefined {
  const parts = accounts.flatMap((a) => (a.overview ? [a.overview] : []))
  if (!parts.length) return undefined
  const prs = new Map<string, DevelopmentOverview["prs"][number]>()
  for (const p of parts.flatMap((o) => o.prs)) if (!prs.has(p.id)) prs.set(p.id, p)
  return {
    prs: [...prs.values()],
    failures: parts.flatMap((o) => o.failures),
    issues: parts.flatMap((o) => o.issues),
    activity: parts.flatMap((o) => o.activity).sort((x, y) => y.at.localeCompare(x.at)),
    repos: parts.flatMap((o) => o.repos ?? []),
  }
}

export function mergeDays(repos: RepoSummary[]) {
  const out: Record<string, number> = {}
  for (const r of repos) for (const [d, n] of Object.entries(r.commitsByDay)) out[d] = (out[d] ?? 0) + n
  return out
}

export function sumSince(days: Record<string, number>, n: number) {
  const from = toDateKey(addDays(new Date(), -(n - 1)))
  return Object.entries(days).reduce((a, [d, c]) => (d >= from ? a + c : a), 0)
}

/** One project's slice of the merged overview: its linked repos only. */
export function projectSlice(data: DevelopmentOverview | undefined, repos: string[]) {
  const mine = new Set(repos.map((r) => r.toLowerCase()))
  const has = (r: string) => mine.has(r.toLowerCase())
  const summaries = (data?.repos ?? []).filter((r) => has(r.repo))
  return {
    summaries,
    prs: data?.prs.filter((p) => has(p.repo)) ?? [],
    failures: data?.failures.filter((f) => has(f.repo)) ?? [],
    issues: data?.issues.filter((i) => has(i.repo)) ?? [],
    activity: data?.activity.filter((a) => has(a.repo)) ?? [],
    days: mergeDays(summaries),
  }
}
