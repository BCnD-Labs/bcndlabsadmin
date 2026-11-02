import type { Course, Draft, JournalEntry, Note, Project, RepoLink, Service, Task } from "../src/lib/types.ts"

export interface Collections {
  tasks: Task[]
  notes: Note[]
  journal: JournalEntry[]
  projects: Project[]
  repos: RepoLink[]
  drafts: Draft[]
  courses: Course[]
  services: Service[]
}
export const COLLECTION_KEYS = ["tasks", "notes", "journal", "projects", "repos", "drafts", "courses", "services"] as const
/** Collections added after the first release: a snapshot written before them simply has none yet. */
const LATER_KEYS: readonly (keyof Collections)[] = ["services"]
export const emptyWorkspace = (): Collections => ({ tasks: [], notes: [], journal: [], projects: [], repos: [], drafts: [], courses: [], services: [] })
export interface WorkspaceSnapshot { id: string; revision: number; data: Collections }

/** Validate both imports and API writes before they can replace durable data. */
export function validWorkspace(value: unknown): value is Collections {
  if (!value || typeof value !== "object") return false
  const data = value as Record<string, unknown>
  // Older snapshots (server, browser cache or an export) predate these collections: they start empty.
  for (const key of LATER_KEYS) if (data[key] === undefined) data[key] = []
  const required: Record<keyof Collections, string[]> = {
    tasks: ["title"], notes: ["text", "color"], journal: ["text"],
    projects: ["name", "code", "status", "description", "color"], repos: ["fullName", "url"],
    drafts: ["title", "slug", "kind", "status", "excerpt", "body"],
    courses: ["title", "code", "instructor", "instructorEmail", "term", "schedule", "location", "url", "description", "color"],
    services: ["name", "url", "description", "group"],
  }
  return COLLECTION_KEYS.every((key) => {
    const rows = data[key]
    if (!Array.isArray(rows) || rows.length > 100_000) return false
    const ids = new Set<string>()
    return rows.every((row) => {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || ids.has(row.id)) return false
      ids.add(row.id)
      if (!["createdAt", "updatedAt", ...required[key]].every((field) => typeof row[field] === "string")) return false
      const enums: Partial<Record<keyof Collections, Record<string, string[]>>> = {
        notes: { color: ["plain", "amber", "teal", "rose", "blue"] },
        projects: { status: ["active", "planned", "paused", "done"], color: ["teal", "amber", "red", "slate"] },
        drafts: { kind: ["post", "page"], status: ["idea", "drafting", "review", "ready"] },
        courses: { color: ["red", "amber", "teal", "blue", "violet", "green", "slate"] },
      }
      if (Object.entries(enums[key] ?? {}).some(([field, choices]) => !choices.includes(row[field]))) return false
      const optionalStrings = ["details", "due", "time", "courseId", "learningType", "completedAt", "projectId", "connectionId", "productionUrl", "previewUrl", "notes", "cover", "coverAlt", "remoteSlug", "startDate", "endDate", "logo", "materialIcon"]
      if (optionalStrings.some((field) => row[field] != null && typeof row[field] !== "string")) return false
      if (row.links != null && (!Array.isArray(row.links) || row.links.length > 50 || !row.links.every((l: unknown) => !!l && typeof l === "object" && typeof (l as { label?: unknown }).label === "string" && typeof (l as { url?: unknown }).url === "string"))) return false
      if (row.tags != null && (!Array.isArray(row.tags) || !row.tags.every((tag: unknown) => typeof tag === "string"))) return false
      if (["credits", "score", "pagesRead", "pagesTotal"].some((field) => row[field] != null && (typeof row[field] !== "number" || !Number.isFinite(row[field])))) return false
      if (key === "courses" && row.kind != null && !["course", "certification", "selfpaced", "skill", "reading"].includes(row.kind)) return false
      if (key === "tasks" && (typeof row.done !== "boolean" || typeof row.starred !== "boolean")) return false
      if ((key === "notes" || key === "services") && typeof row.pinned !== "boolean") return false
      if (key === "courses" && (!Array.isArray(row.tags) || !row.tags.every((tag: unknown) => typeof tag === "string"))) return false
      return true
    })
  })
}

function canonical(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item)
}
export const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b)

/** Three-way record merge. Deletions and concurrent edits of the same record require review. */
export function mergeWorkspace(base: Collections, local: Collections, remote: Collections) {
  const data = emptyWorkspace()
  const conflicts: string[] = []
  for (const key of COLLECTION_KEYS) {
    const b = new Map(base[key].map((row) => [row.id, row]))
    const l = new Map(local[key].map((row) => [row.id, row]))
    const r = new Map(remote[key].map((row) => [row.id, row]))
    const merged: Collections[typeof key][number][] = []
    for (const id of new Set([...l.keys(), ...r.keys(), ...b.keys()])) {
      const before = b.get(id), ours = l.get(id), theirs = r.get(id)
      let row = theirs
      if (same(before, ours)) row = theirs
      else if (same(before, theirs) || same(ours, theirs)) row = ours
      else { conflicts.push(`${key}: ${id}`); row = ours }
      if (row) merged.push(row)
    }
    // Assignment through a common structural array keeps the domain interfaces intact.
    Object.assign(data, { [key]: merged })
  }
  return { data, conflicts }
}
