/** Domain records stored locally in the browser. See stores/workspace.ts. */

export type ID = string
/** Calendar date without time, `yyyy-MM-dd`. */
export type DateKey = string
/** ISO timestamp. */
export type Timestamp = string

export type Priority = "low" | "medium" | "high" | "urgent"
export type TaskStatus = "todo" | "in-progress" | "done"

export interface Task {
  id: ID
  title: string
  notes?: string
  status: TaskStatus
  priority: Priority
  due?: DateKey
  projectId?: ID
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt?: Timestamp
}

export interface CalendarEvent {
  id: ID
  title: string
  date: DateKey
  /** `HH:mm`; omitted for all-day events. */
  start?: string
  end?: string
  location?: string
  notes?: string
  projectId?: ID
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type NoteKind = "note" | "reference" | "link"

export interface Note {
  id: ID
  title: string
  body: string
  kind: NoteKind
  url?: string
  pinned: boolean
  projectId?: ID
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
