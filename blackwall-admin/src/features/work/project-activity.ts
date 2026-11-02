import { mergeAccounts, projectSlice, sumSince } from "@/features/development/github-utils"
import { lastDays } from "@/features/home/overview-panels"
import { useGitHubAccounts } from "@/services/data"
import type { Project, RepoLink } from "@/lib/types"

/** GitHub activity for each project, from the repos linked to it. `live` is false without GitHub data. */
export function useProjectActivity(projects: Project[], repos: RepoLink[]) {
  const feed = useGitHubAccounts()
  const merged = mergeAccounts(feed.data ?? [])
  const byProject = new Map(
    projects.map((p) => {
      const linked = repos.filter((r) => r.projectId === p.id)
      const slice = projectSlice(merged, linked.map((r) => r.fullName))
      return [p.id, { ...slice, linked, spark: lastDays(slice.days, 14), commits14: sumSince(slice.days, 14), lastPush: slice.summaries.map((s) => s.pushedAt).filter(Boolean).sort().at(-1) }] as const
    }),
  )
  return { feed, live: !!merged, byProject }
}
export type ProjectActivity = ReturnType<typeof useProjectActivity>["byProject"] extends Map<string, infer V> ? V : never
