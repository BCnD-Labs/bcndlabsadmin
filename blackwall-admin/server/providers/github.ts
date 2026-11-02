import type { CheckFailure, DevelopmentOverview, IssueSummary, PullRequestSummary, RepoActivity, RepoSummary } from "../../shared/connections.ts"
import type { StoredConnection } from "../store.ts"
import { ProviderError, dateKey, daysAgo, fmtCount, getJson, need } from "../http.ts"
import type { TestResult } from "./index.ts"

/* eslint-disable @typescript-eslint/no-explicit-any */
function client(c: StoredConnection) {
  const token = need(c.secrets.token, "GitHub token")
  return <T = any>(path: string) =>
    getJson<T>(
      `https://api.github.com${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "blackwall-admin",
        },
      },
      "GitHub",
    )
}

export async function testGitHub(c: StoredConnection): Promise<TestResult> {
  const gh = client(c)
  const user = await gh("/user")
  const repos = (user.public_repos ?? 0) + (user.total_private_repos ?? 0)
  return {
    status: "ok",
    account: `@${user.login}`,
    summary: [
      { label: "Account", value: user.name ? `${user.name} (@${user.login})` : `@${user.login}` },
      { label: "Repositories visible", value: fmtCount(repos) },
    ],
  }
}

const repoFromUrl = (url: string) => url.replace("https://api.github.com/repos/", "")

async function checksFor(gh: ReturnType<typeof client>, repo: string, number: number): Promise<PullRequestSummary["checks"]> {
  try {
    const pr = await gh(`/repos/${repo}/pulls/${number}`)
    const runs = await gh(`/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=50`)
    const list: any[] = runs.check_runs ?? []
    if (!list.length) return "unknown"
    if (list.some((r) => ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion))) return "failing"
    if (list.some((r) => r.status !== "completed")) return "pending"
    return "passing"
  } catch {
    return "unknown"
  }
}

export async function githubOverview(c: StoredConnection, repos: string[]): Promise<DevelopmentOverview> {
  const gh = client(c)
  const tracked = repos.filter((r) => /^[\w.-]+\/[\w.-]+$/.test(r)).slice(0, 10)
  if (!tracked.length) return { prs: [], failures: [], issues: [], activity: [], repos: [] }

  // Only pull requests in tracked repositories (several repo: qualifiers are OR'd).
  const scope = tracked.map((r) => `repo:${r}`).join(" ")
  const search = async (q: string, kind: PullRequestSummary["kind"]) => {
    const res = await gh(`/search/issues?q=${encodeURIComponent(`is:open is:pr archived:false ${q} ${scope}`)}&per_page=10&sort=updated`)
    return (res.items as any[]).map(
      (i): PullRequestSummary => ({
        id: `pr-${i.id}`,
        repo: repoFromUrl(i.repository_url),
        number: i.number,
        title: i.title,
        author: i.user?.login ?? "",
        url: i.html_url,
        updatedAt: i.updated_at,
        kind,
        checks: "unknown",
      }),
    )
  }

  const [review, mine] = await Promise.all([search("review-requested:@me", "review-requested"), search("author:@me", "authored")])
  const prs = [...review, ...mine]
  await Promise.all(prs.slice(0, 8).map(async (p) => (p.checks = await checksFor(gh, p.repo, p.number))))

  const perRepo = await Promise.all(
    tracked.map(async (repo) => {
      const since = daysAgo(26 * 7).toISOString()
      const commitPage = (page: number) => gh<any[]>(`/repos/${repo}/commits?since=${since}&per_page=100&page=${page}`).catch(() => [])
      const [runs, issues, events, info, languages, commits1] = await Promise.all([
        gh(`/repos/${repo}/actions/runs?per_page=30`).catch(() => ({ workflow_runs: [] })),
        gh<any[]>(`/repos/${repo}/issues?state=open&per_page=10&sort=updated`).catch(() => []),
        gh<any[]>(`/repos/${repo}/events?per_page=30`).catch(() => []),
        gh(`/repos/${repo}`).catch(() => null),
        gh<Record<string, number>>(`/repos/${repo}/languages`).catch(() => ({}) as Record<string, number>),
        commitPage(1),
      ])
      // Up to 300 commits for the history; more than that in 26 weeks just caps the heatmap.
      let commits = commits1
      if (commits1.length === 100) commits = [...commits, ...(await commitPage(2))]
      if (commits.length === 200) commits = [...commits, ...(await commitPage(3))]

      // Latest run per workflow+branch; report it only if that latest run failed.
      const latest = new Map<string, any>()
      for (const r of runs.workflow_runs as any[]) {
        const key = `${r.workflow_id}:${r.head_branch}`
        if (!latest.has(key)) latest.set(key, r)
      }
      const failures: CheckFailure[] = [...latest.values()]
        .filter((r) => r.conclusion === "failure" || r.conclusion === "timed_out")
        .map((r) => ({
          id: `run-${r.id}`,
          repo,
          branch: r.head_branch,
          workflow: r.name,
          commit: String(r.head_sha).slice(0, 7),
          url: r.html_url,
          failedAt: r.updated_at,
        }))

      const openIssues: IssueSummary[] = issues
        .filter((i) => !i.pull_request)
        .map((i) => ({
          id: `is-${i.id}`,
          repo,
          number: i.number,
          title: i.title,
          labels: (i.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name)),
          url: i.html_url,
          updatedAt: i.updated_at,
        }))

      // Commits come from the commits API (immediate, with messages); merges, releases
      // and new issues from the events feed, which can lag by a few hours.
      const commitActivity: RepoActivity[] = commits.slice(0, 15).map((cm) => ({
        id: `cm-${cm.sha}`,
        repo,
        kind: "commit",
        summary: String(cm.commit?.message ?? "").split("\n")[0].slice(0, 140),
        actor: cm.author?.login ?? cm.commit?.author?.name ?? "",
        at: cm.commit?.committer?.date ?? cm.commit?.author?.date ?? "",
        sha: String(cm.sha).slice(0, 7),
        url: cm.html_url,
        avatar: cm.author?.avatar_url,
      }))
      const commitsByDay: Record<string, number> = {}
      for (const cm of commits) {
        const at = cm.commit?.author?.date ?? cm.commit?.committer?.date
        if (!at) continue
        const k = dateKey(new Date(at))
        commitsByDay[k] = (commitsByDay[k] ?? 0) + 1
      }
      const total = Object.values(languages).reduce((a, b) => a + b, 0)
      const summary: RepoSummary = {
        repo,
        description: info?.description ?? undefined,
        private: !!info?.private,
        defaultBranch: info?.default_branch ?? "main",
        stars: info?.stargazers_count ?? 0,
        pushedAt: info?.pushed_at ?? undefined,
        languages: Object.entries(languages)
          .sort((a, b) => b[1] - a[1])
          .filter(([, bytes]) => total && bytes / total >= 0.005)
          .map(([name, bytes]) => ({ name, bytes })),
        commitsByDay,
      }

      const eventActivity: RepoActivity[] = events.flatMap((e): RepoActivity[] => {
        const base = { id: `ev-${e.id}`, repo, actor: e.actor?.login ?? "", at: e.created_at, avatar: e.actor?.avatar_url }
        switch (e.type) {
          case "PullRequestEvent":
            return e.payload?.action === "closed" && e.payload?.pull_request?.merged
              ? [{ ...base, kind: "merge", summary: `Merged #${e.payload.pull_request.number} ${e.payload.pull_request.title}` }]
              : []
          case "ReleaseEvent":
            return [{ ...base, kind: "release", summary: `Released ${e.payload?.release?.tag_name ?? ""}`.trim() }]
          case "IssuesEvent":
            return e.payload?.action === "opened"
              ? [{ ...base, kind: "issue", summary: `Opened #${e.payload.issue.number} ${e.payload.issue.title}` }]
              : []
          default:
            return []
        }
      })
      return { failures, openIssues, activity: [...commitActivity, ...eventActivity], summary }
    }),
  )

  if (!perRepo.length) throw new ProviderError("No repositories to load")
  const byDate = <T>(key: (t: T) => string) => (a: T, b: T) => key(b).localeCompare(key(a))
  return {
    prs,
    failures: perRepo.flatMap((r) => r.failures).sort(byDate((f) => f.failedAt)),
    issues: perRepo.flatMap((r) => r.openIssues).sort(byDate((i) => i.updatedAt)).slice(0, 20),
    activity: perRepo.flatMap((r) => r.activity).sort(byDate((a) => a.at)).slice(0, 25),
    repos: perRepo.map((r) => r.summary),
  }
}
