/** Domain records shared through the Blackwall server. See stores/workspace.ts. */

export type ID = string
/** Calendar date without time, `yyyy-MM-dd`. */
export type DateKey = string
/** ISO timestamp. */
export type Timestamp = string

/** A to-do, Google Tasks style: no priorities or dependencies. */
/** A link to a document or page that lives elsewhere (Drive, Nextcloud, Obsidian, OneNote…). Opens outside Blackwall. */
export interface DocLink {
  label: string
  url: string
}

export interface Task {
  id: ID
  /** Linked documents (open in their own app). */
  links?: DocLink[]
  title: string
  details?: string
  due?: DateKey
  /** Optional time on the due date, `HH:mm` (exams, events). */
  time?: string
  /** Coursework: the course it belongs to and what kind of item it is. */
  courseId?: ID
  learningType?: LearningItemType
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
  /** Linked documents (open in their own app). */
  links?: DocLink[]
  text: string
  color: NoteColor
  /** Pinned notes show on Home. */
  pinned: boolean
  /** Linked course (Productivity → Learning). */
  courseId?: ID
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

/** A repository the workspace tracks. The link is a workspace record; activity comes from a DevelopmentService. */
export interface RepoLink {
  id: ID
  /** `owner/name` */
  fullName: string
  url: string
  projectId?: ID
  /** Which GitHub connection reads this repo; unset = the first working one. */
  connectionId?: string
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
  /** Chips on the post and its blog card, e.g. "Week 11". */
  tags?: string[]
  /** Site-root path of the cover image (uploaded to the site's images folder). */
  cover?: string
  coverAlt?: string
  /**
   * Slug of the post on the site this draft publishes to, once it's been published
   * or scheduled. If the slug changes afterwards, the next update renames the post.
   */
  remoteSlug?: string
  projectId?: ID
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** What a piece of coursework is. All of them are tasks, so they share the calendar and Tasks. */
export type LearningItemType = "assignment" | "exam" | "milestone" | "event"

export type CourseColor = "red" | "amber" | "teal" | "blue" | "violet" | "green" | "slate"

/** A college course (Productivity → Learning). Workspace record; no LMS connection. */
export interface Course {
  id: ID
  /** Linked documents (open in their own app). */
  links?: DocLink[]
  title: string
  /** e.g. `CS 2110` */
  code: string
  instructor: string
  instructorEmail: string
  /** e.g. `Fall 2026` */
  term: string
  startDate?: DateKey
  endDate?: DateKey
  /** Free text, e.g. `Mon/Wed 10:00–11:15` */
  schedule: string
  location: string
  /** Course site or LMS page. */
  url: string
  credits?: number
  description: string
  tags: string[]
  color: CourseColor
  createdAt: Timestamp
  updatedAt: Timestamp
}
