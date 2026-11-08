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
  /** Standalone calendar events share scheduling fields; absent means an ordinary task. */
  kind?: "task" | "event"
  /** Planner additions are optional so older workspaces retain their meaning. */
  focusDate?: DateKey
  scheduledDate?: DateKey
  scheduledTime?: string
  durationMinutes?: number
  reflection?: TaskReflection
  recordLinks?: RecordLink[]
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
  /** Where a piece of coursework is in its life. Absent on older records: derive it from `done`. */
  status?: WorkStatus
  /** How big the work feels; sets how many days ahead the planner suggests starting. */
  effort?: WorkEffort
  /** Smaller steps inside this task; each can have its own day. */
  subtasks?: Subtask[]
  /** The course topics (units, modules, chapters) this assignment or exam covers. */
  topicIds?: ID[]
  /** Practice tests (certifications): the score, 0–100. */
  score?: number
  starred: boolean
  done: boolean
  completedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** One small step inside a task: "Outline", "Review: Recursion". A date puts it on that day's plan. */
export interface Subtask {
  id: ID
  title: string
  done: boolean
  date?: DateKey
  /** The course topic a study step reviews. */
  topicId?: ID
}

/** A unit, module or chapter of a course. `done` means "I know this one". */
export interface CourseTopic {
  id: ID
  title: string
  done?: boolean
}

export interface RecordLink {
  kind: "note" | "task" | "log"
  id: string
}

export interface TaskReflection {
  text: string
  /** Only fields explicitly added by the writer are stored. */
  items: Partial<Record<ReflectionItem, string>>
  updatedAt: Timestamp
}

export type ReflectionItem = "difficulty" | "timeSpent" | "help" | "outcome" | "nextTime" | "learned" | "blocker"

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

export interface JournalSection { id: ID; title: string; text: string; noteId?: ID }
export interface JournalLogItem { id: ID; text: string; createdAt: Timestamp; updatedAt: Timestamp; sectionId?: ID; noteId?: ID; courseId?: ID; taskId?: ID }

/** One daily log entry per day; `id` is the date. */
export interface JournalEntry {
  id: DateKey
  text: string
  /** Explicitly added tabs for this day only; no defaults, at most three. */
  sections?: JournalSection[]
  /** Individual entries added from the compact daily log list. */
  entries?: JournalLogItem[]
  mainNoteId?: ID
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
  /** CMS: the Blackwall site this post belongs to (rendered and published with it). */
  siteId?: ID
  /** Course portal: the week number and course code it's filed under, and when it's due. */
  week?: number
  course?: string
  due?: DateKey
  /** CMS site posts: when it was published (included in site builds from then on). */
  publishedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** One block on a CMS page (Pagesmith's model): containers (section, row, card) hold `kids`. */
export interface SiteBlock {
  id: string
  type: string
  kids?: SiteBlock[]
  /** The section preset it came from, e.g. "hero". */
  preset?: string
  [prop: string]: unknown
}

export interface SitePalette { bg: string; surface: string; text: string; muted: string; border: string; accent: string }

/** A website Blackwall builds and publishes (CMS). */
export interface Site {
  id: ID
  name: string
  /** e.g. "bcndlabs.dev" (no scheme). */
  domain: string
  /** Website-publishing connection (GitHub repo + branch) it publishes to. */
  connectionId?: string
  /** Folder in the repo the site is written to; "" = the repository root. */
  root: string
  starter: string
  light: SitePalette
  dark: SitePalette
  darkMode: boolean
  customCss: string
  footerText: string
  /** Old address → new address, e.g. /about → /projects. */
  redirects: { from: string; to: string }[]
  /** Public form endpoint (the Cloudflare Worker) and its Turnstile site key. */
  formEndpoint?: string
  turnstileKey?: string
  /** Show approved comments and a comment form under posts. */
  comments?: boolean
  publishedAt?: Timestamp
  publishedSha?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A page of a CMS site. `slug` "" is the home page. */
export interface SitePage {
  id: ID
  siteId: ID
  title: string
  slug: string
  description: string
  inMenu: boolean
  order: number
  sections: SiteBlock[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SiteFormField { id: string; label: string; type: "text" | "email" | "textarea" | "select" | "checkbox"; required: boolean; options?: string[] }

/** A reusable form (library) usable on any site's pages. Email is always collected and verified. */
export interface SiteForm {
  id: ID
  name: string
  fields: SiteFormField[]
  submitLabel: string
  successMessage: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A social platform. "other" covers anything else (YouTube, LinkedIn, Bluesky…). */
export type SocialPlatform = "instagram" | "facebook" | "threads" | "x" | "tiktok" | "reddit" | "other"

/** One of your social accounts, tagged with the brand it speaks for. */
export interface SocialAccount {
  id: ID
  platform: SocialPlatform
  /** @handle or page name. */
  name: string
  /** "Personal", "BCnD Labs", "Sprouts & Scraps"… what the account speaks for. */
  brand: string
  /** Profile address; also what "Open" uses. */
  url: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A social post you plan, write once and post by hand to one or more accounts. */
export interface SocialPost {
  id: ID
  title: string
  /** The caption / post text. */
  body: string
  link?: string
  /** Where the photo or video is (a Nextcloud link, a file name) and notes on it. */
  media?: string
  stage: "idea" | "draft" | "ready"
  accountIds: string[]
  /** When to post it; you get a reminder then. */
  scheduledAt?: Timestamp
  /** Accounts it's been posted to, when, and the live post's address. */
  posted: { accountId: string; at: Timestamp; url?: string }[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A launcher tile on the Mikoshi page: a link to one self-hosted service. */
export interface Service {
  id: ID
  name: string
  url: string
  /** "Containers", "Files": what it is, one or two words. */
  description: string
  /** The section it sits in, e.g. "Infrastructure". */
  group: string
  /** dashboard-icons slug (e.g. `portainer`); the server keeps a copy. Empty = Material icon. */
  logo?: string
  /** Material Symbols name used when there's no logo, e.g. `dns`. */
  materialIcon?: string
  /** A logo you uploaded (small image data URL); wins over `logo` and `materialIcon`. */
  customLogo?: string
  /** Big tile in the row at the top. */
  pinned: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** What a piece of coursework is. All of them are tasks, so they share the calendar and Tasks. */
export type LearningItemType = "assignment" | "exam" | "milestone" | "event"

/** What kind of learning a record is. Older records have no kind and are courses. */
export type LearningKind = "course" | "certification" | "selfpaced" | "skill" | "reading"

/** Not started, working on it, handed in, marked. Submitted and graded both mean the task is done. */
export type WorkStatus = "not_started" | "in_progress" | "submitted" | "graded"
export type WorkEffort = "quick" | "medium" | "big"

export type MeetingKind = "class" | "lab" | "office" | "other"
/** A weekly meeting time. It repeats on `days` (0 = Sunday) between the course's start and end dates. */
export interface ClassMeeting {
  id: ID
  kind: MeetingKind
  days: number[]
  /** `HH:mm` */
  start: string
  end: string
  location?: string
}

export type CourseColor = "red" | "amber" | "teal" | "blue" | "violet" | "green" | "slate"

/**
 * One piece of learning (Productivity → Learning): a class, a certification, a self-paced
 * course, a skill or a book. Workspace record; no LMS connection. The shared fields are
 * relabeled per kind (e.g. `instructor` is the vendor, platform or author).
 */
export interface Course {
  id: ID
  /** Missing on older records, which are courses. */
  kind?: LearningKind
  /** Reading: pages read and total pages. */
  pagesRead?: number
  pagesTotal?: number
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
  /** Structured weekly class and office-hour times; they appear on the calendar. `schedule` stays as free text. */
  meetings?: ClassMeeting[]
  /** Syllabus and policies, as notes the writer keeps with the course. */
  syllabus?: string
  policies?: string
  /** The class's code repository. */
  repoUrl?: string
  /** Units, modules or chapters, in order. Assignments and exams can point at them. */
  topics?: CourseTopic[]
  credits?: number
  description: string
  tags: string[]
  color: CourseColor
  createdAt: Timestamp
  updatedAt: Timestamp
}

