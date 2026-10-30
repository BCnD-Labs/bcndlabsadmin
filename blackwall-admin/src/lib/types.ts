/** Domain records stored locally in the browser. See stores/workspace.ts. */

export type ID = string
/** Calendar date without time, `yyyy-MM-dd`. */
export type DateKey = string
/** ISO timestamp. */
export type Timestamp = string

/** A to-do, Google Tasks style: no priorities, tags, links or dependencies. */
export interface Task {
  id: ID
  title: string
  details?: string
  due?: DateKey
  starred: boolean
  done: boolean
  completedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type NoteColor = "plain" | "amber" | "teal" | "rose" | "blue"

/** A sticky / quick note. */
export interface Note {
  id: ID
  text: string
  color: NoteColor
  /** Pinned notes show on Home. */
  pinned: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** One daily log entry per day; `id` is the date. */
export interface JournalEntry {
  id: DateKey
  text: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ProjectStatus = "active" | "planned" | "paused" | "done"
export type ProjectColor = "teal" | "amber" | "red" | "slate"

export interface Project {
  id: ID
  name: string
  /** Short key shown on tags, e.g. `WEB`. */
  code: string
  status: ProjectStatus
  description: string
  color: ProjectColor
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A repository the workspace tracks. Only the link is local; activity comes from a DevelopmentService. */
export interface RepoLink {
  id: ID
  /** `owner/name` */
  fullName: string
  url: string
  projectId?: ID
  productionUrl?: string
  previewUrl?: string
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type DraftKind = "post" | "page"
export type DraftStatus = "idea" | "drafting" | "review" | "ready"

export interface Draft {
  id: ID
  title: string
  slug: string
  kind: DraftKind
  status: DraftStatus
  excerpt: string
  body: string
  projectId?: ID
  createdAt: Timestamp
  updatedAt: Timestamp
}
