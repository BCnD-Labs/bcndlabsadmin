import { daysUntil } from "@/lib/dates"
import { learningHref, plannerHref, postsHref, projectsHref } from "@/lib/routes"
import { useWorkspace } from "@/stores/workspace"

export interface NavHints {
  /** Short status beside the label in the expanded pill. */
  hint?: string
  /** Count or status beside a sub-page, keyed by its `to`. */
  subs?: Record<string, string>
}

/**
 * Rail hints from local workspace data only. Sections without a local source
 * (Analytics, Reviews, Settings…) get nothing rather than a made-up number.
 */
export function useNavHints(): Record<string, NavHints> {
  const open = useWorkspace((s) => s.tasks.filter((t) => !t.done).length)
  const projects = useWorkspace((s) => s.projects.length)
  const repos = useWorkspace((s) => s.repos.length)
  const drafts = useWorkspace((s) => s.drafts.length)
  const courses = useWorkspace((s) => s.courses.length)
  // Coursework due in the next 7 days (or overdue).
  const dueSoon = useWorkspace((s) => s.tasks.filter((t) => t.courseId && !t.done && t.due && daysUntil(t.due) <= 7).length)

  const n = (count: number) => (count ? String(count) : "")
  return {
    productivity: {
      hint: `${open} open`,
      subs: {
        [plannerHref]: n(open),
        [projectsHref]: n(projects),
        [learningHref]: dueSoon ? `${dueSoon} due` : n(courses),
      },
    },
    development: { hint: repos ? `${repos} repos` : undefined },
    cms: { hint: drafts ? `${drafts} drafts` : undefined, subs: { [postsHref]: n(drafts) } },
  }
}

/** Avatar initials from the workspace name: "Blackwall404" → "B4", "bcnd labs" → "BL". */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_\-.]+|(?<=[a-z])(?=[A-Z0-9])|(?<=[0-9])(?=[A-Za-z])/)
    .filter(Boolean)
  if (!parts.length) return "BW"
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  return s.toUpperCase()
}
