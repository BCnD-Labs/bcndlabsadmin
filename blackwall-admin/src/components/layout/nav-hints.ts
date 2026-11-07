import { daysUntil } from "@/lib/dates"
import { learningHref, plannerHref, postsHref, projectsHref } from "@/lib/routes"
import { KINDS } from "@/features/learning/learning-utils"
import { learningKindHref } from "./nav-model"
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
  // How many records of each kind, as a stable key ("course:2,certification:1").
  const kindKey = useWorkspace((s) => KINDS.map((k) => `${k.value}:${s.courses.filter((c) => (c.kind ?? "course") === k.value).length}`).join(","))
  const kindCounts = Object.fromEntries(kindKey.split(",").map((pair) => pair.split(":")).map(([k, v]) => [k, Number(v)]))
  const courses = Object.values(kindCounts).reduce((a, b) => a + b, 0)
  // Coursework due in the next 7 days (or overdue).
  const dueSoon = useWorkspace((s) => s.tasks.filter((t) => t.courseId && !t.done && t.due && daysUntil(t.due) <= 7).length)

  const n = (count: number) => (count ? String(count) : "")
  return {
    productivity: {
      hint: `${open} open`,
      subs: {
        [plannerHref]: n(open),
        [projectsHref]: n(projects),
      },
    },
    // Learning's children are derived from the same records (see learningChildren), so every kind shown has a count.
    learning: {
      hint: dueSoon ? `${dueSoon} due` : courses ? String(courses) : undefined,
      subs: {
        [learningHref]: dueSoon ? `${dueSoon} due` : n(courses),
        ...Object.fromEntries(KINDS.map((k) => [learningKindHref(k.value), n(kindCounts[k.value] ?? 0)])),
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
