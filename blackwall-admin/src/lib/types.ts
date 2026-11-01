/** Domain records stored locally in the browser. See stores/workspace.ts. */

export type ID = string
/** Calendar date without time, `yyyy-MM-dd`. */
export type DateKey = string
/** ISO timestamp. */
export type Timestamp = string

/** A to-do, Google Tasks style: no priorities or dependencies. */
export interface Task {
  id: ID
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

/** What a piece of coursework is. All of them are tasks, so they share the calendar and Tasks. */
export type LearningItemType = "assignment" | "exam" | "milestone" | "event"

export type CourseColor = "red" | "amber" | "teal" | "blue" | "violet" | "green" | "slate"

/** A college course (Productivity → Learning). Local only; no LMS connection. */
export interface Course {
  id: ID
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
