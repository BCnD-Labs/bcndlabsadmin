import type { Asset, Course, Draft, JournalEntry, Note, Project, RepoLink, Service, Site, SiteForm, SitePage, SocialAccount, SocialPost, Task } from "../src/lib/types.ts"
import { validJournalItems, validJournalSections } from "./journal-sections.ts"
import { validPlannerFields } from "./planner.ts"

export interface Collections {
  tasks: Task[]
  notes: Note[]
  journal: JournalEntry[]
  projects: Project[]
  repos: RepoLink[]
  drafts: Draft[]
  courses: Course[]
  services: Service[]
  sites: Site[]
  pages: SitePage[]
  forms: SiteForm[]
  socialAccounts: SocialAccount[]
  socialPosts: SocialPost[]
  assets: Asset[]
}
export const COLLECTION_KEYS = ["tasks", "notes", "journal", "projects", "repos", "drafts", "courses", "services", "sites", "pages", "forms", "socialAccounts", "socialPosts", "assets"] as const
/** Collections added after the first release: a snapshot written before them simply has none yet. */
const LATER_KEYS: readonly (keyof Collections)[] = ["services", "sites", "pages", "forms", "socialAccounts", "socialPosts", "assets"]
export const emptyWorkspace = (): Collections => ({ tasks: [], notes: [], journal: [], projects: [], repos: [], drafts: [], courses: [], services: [], sites: [], pages: [], forms: [], socialAccounts: [], socialPosts: [], assets: [] })
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
    sites: ["name", "domain", "root", "starter", "customCss", "footerText"],
    pages: ["siteId", "title", "slug", "description"],
    forms: ["name", "submitLabel", "successMessage"],
    socialAccounts: ["platform", "name", "brand", "url"],
    socialPosts: ["title", "body", "stage"],
    assets: ["name", "file", "folder", "mime", "alt"],
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
        socialAccounts: { platform: ["instagram", "facebook", "threads", "x", "tiktok", "reddit", "other"] },
        socialPosts: { stage: ["idea", "draft", "ready"] },
      }
      if (Object.entries(enums[key] ?? {}).some(([field, choices]) => !choices.includes(row[field]))) return false
      const optionalStrings = ["details", "due", "time", "courseId", "learningType", "completedAt", "projectId", "connectionId", "productionUrl", "previewUrl", "notes", "cover", "coverAlt", "remoteSlug", "startDate", "endDate", "logo", "materialIcon", "customLogo", "siteId", "course", "publishedAt", "formEndpoint", "turnstileKey", "publishedSha", "link", "media", "scheduledAt", "syllabus", "policies", "repoUrl", "workType"]
      if (optionalStrings.some((field) => row[field] != null && typeof row[field] !== "string")) return false
      if (row.links != null && (!Array.isArray(row.links) || row.links.length > 50 || !row.links.every((l: unknown) => !!l && typeof l === "object" && typeof (l as { label?: unknown }).label === "string" && typeof (l as { url?: unknown }).url === "string"))) return false
      if (row.tags != null && (!Array.isArray(row.tags) || !row.tags.every((tag: unknown) => typeof tag === "string"))) return false
      if (["credits", "score", "pagesRead", "pagesTotal", "week", "order"].some((field) => row[field] != null && (typeof row[field] !== "number" || !Number.isFinite(row[field])))) return false
      if (key === "courses" && row.kind != null && !["course", "certification", "selfpaced", "skill", "reading"].includes(row.kind)) return false
      if (key === "tasks" && (typeof row.done !== "boolean" || typeof row.starred !== "boolean")) return false
      if (key === "tasks" && typeof row.workType === "string" && row.workType.length > 60) return false
      if (key === "tasks" && !validPlannerFields(row)) return false
      if (key === "tasks" && ((row.status != null && !["not_started", "in_progress", "submitted", "graded"].includes(row.status)) || (row.effort != null && !["quick", "medium", "big"].includes(row.effort)))) return false
      if (key === "courses" && !validMeetings(row.meetings)) return false
      if (key === "courses" && !validTopics(row.topics)) return false
      if (key === "tasks" && (!validSubtasks(row.subtasks) || !validTopicIds(row.topicIds))) return false
      if (key === "notes" && !validTopicIds(row.topicIds)) return false
      if (key === "courses" && ["syllabus", "policies"].some((field) => typeof row[field] === "string" && row[field].length > 100_000)) return false
      if (key === "journal" && row.sections !== undefined && !validJournalSections(row.sections)) return false
      if (key === "journal" && row.entries !== undefined && !validJournalItems(row.entries, row.sections ?? [])) return false
      if (key === "journal" && row.mainNoteId !== undefined && (typeof row.mainNoteId !== "string" || !row.mainNoteId || row.mainNoteId.length > 100)) return false
      if ((key === "notes" || key === "services") && typeof row.pinned !== "boolean") return false
      // An uploaded tile logo is a small image data URL (resized in the browser before saving).
      if (key === "services" && row.customLogo != null && (row.customLogo.length > 200_000 || !/^data:image\/(png|webp|jpeg|svg\+xml)[;,]/.test(row.customLogo))) return false
      if (key === "sites" && row.comments !== undefined && typeof row.comments !== "boolean") return false
      if (key === "sites" && (!isPalette(row.light) || !isPalette(row.dark) || typeof row.darkMode !== "boolean" || !Array.isArray(row.redirects) || !row.redirects.every((x: unknown) => !!x && typeof (x as { from?: unknown }).from === "string" && typeof (x as { to?: unknown }).to === "string"))) return false
      if (key === "assets" && (["width", "height", "bytes"].some((f) => typeof row[f] !== "number" || !Number.isFinite(row[f]) || row[f] < 0) || !/^[\w][\w.-]{0,120}$/.test(row.file) || row.file.includes(".."))) return false
      if (key === "pages" && (typeof row.inMenu !== "boolean" || typeof row.order !== "number" || !Array.isArray(row.sections) || JSON.stringify(row.sections).length > 2_000_000)) return false
      if (key === "forms" && (!Array.isArray(row.fields) || row.fields.length > 40 || !row.fields.every((f: unknown) => !!f && typeof (f as { label?: unknown }).label === "string"))) return false
      if (key === "socialPosts" && (!Array.isArray(row.accountIds) || !row.accountIds.every((a: unknown) => typeof a === "string") || !Array.isArray(row.posted) || !row.posted.every((x: unknown) => !!x && typeof (x as { accountId?: unknown }).accountId === "string" && typeof (x as { at?: unknown }).at === "string"))) return false
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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
function validMeetings(value: unknown): boolean {
  if (value == null) return true
  if (!Array.isArray(value) || value.length > 30) return false
  const ids = new Set<string>()
  return value.every((m: unknown) => {
    if (!m || typeof m !== "object") return false
    const x = m as Record<string, unknown>
    if (typeof x.id !== "string" || !x.id || x.id.includes(":") || ids.has(x.id)) return false
    ids.add(x.id)
    if (!["class", "lab", "office", "other"].includes(String(x.kind))) return false
    if (!Array.isArray(x.days) || !x.days.length || x.days.length > 7 || !x.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return false
    if (typeof x.start !== "string" || typeof x.end !== "string" || !TIME.test(x.start) || !TIME.test(x.end) || x.end <= x.start) return false
    return x.location == null || (typeof x.location === "string" && x.location.length <= 200)
  })
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
function validTopics(value: unknown): boolean {
  if (value == null) return true
  if (!Array.isArray(value) || value.length > 80) return false
  const ids = new Set<string>()
  return value.every((t: unknown) => {
    if (!t || typeof t !== "object") return false
    const x = t as Record<string, unknown>
    if (typeof x.id !== "string" || !x.id || x.id.length > 100 || ids.has(x.id)) return false
    ids.add(x.id)
    return typeof x.title === "string" && x.title.length <= 200 && (x.done == null || typeof x.done === "boolean")
  })
}
function validSubtasks(value: unknown): boolean {
  if (value == null) return true
  if (!Array.isArray(value) || value.length > 100) return false
  const ids = new Set<string>()
  return value.every((t: unknown) => {
    if (!t || typeof t !== "object") return false
    const x = t as Record<string, unknown>
    if (typeof x.id !== "string" || !x.id || x.id.length > 100 || ids.has(x.id)) return false
    ids.add(x.id)
    if (typeof x.title !== "string" || x.title.length > 300 || typeof x.done !== "boolean") return false
    if (x.date != null && (typeof x.date !== "string" || !DATE_KEY.test(x.date))) return false
    return x.topicId == null || (typeof x.topicId === "string" && x.topicId.length <= 100)
  })
}
function validTopicIds(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.length <= 80 && value.every((v) => typeof v === "string" && v.length <= 100))
}

const PALETTE_KEYS = ["bg", "surface", "text", "muted", "border", "accent"]
function isPalette(p: unknown): boolean {
  return !!p && typeof p === "object" && PALETTE_KEYS.every((k) => typeof (p as Record<string, unknown>)[k] === "string")
}

