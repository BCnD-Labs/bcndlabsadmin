import { daysUntil, todayKey } from "@/lib/dates"
import { calendarHref, draftsHref, learningHref, notesHref, projectsHref, tasksHref } from "@/lib/routes"
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
  const notes = useWorkspace((s) => s.notes.length)
  const projects = useWorkspace((s) => s.projects.length)
  const repos = useWorkspace((s) => s.repos.length)
  const drafts = useWorkspace((s) => s.drafts.length)
  const logged = useWorkspace((s) => s.journal.some((j) => j.id === todayKey()))
  const courses = useWorkspace((s) => s.courses.length)
  // Coursework due in the next 7 days (or overdue).
  const dueSoon = useWorkspace((s) => s.tasks.filter((t) => t.courseId && !t.done && t.due && daysUntil(t.due) <= 7).length)

  const n = (count: number) => (count ? String(count) : "")
  return {
    productivity: {
      hint: `${open} open`,
      subs: {
        [tasksHref]: n(open),
        [projectsHref]: n(projects),
        [learningHref]: dueSoon ? `${dueSoon} due` : n(courses),
        [calendarHref]: logged ? "logged" : "",
        [notesHref]: n(notes),
      },
    },
    development: { hint: repos ? `${repos} repos` : undefined, subs: { "/development/repositories": n(repos) } },
    cms: { hint: drafts ? `${drafts} drafts` : undefined, subs: { [draftsHref]: n(drafts) } },
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
