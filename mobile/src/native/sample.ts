/**
 * SAMPLE DATA for the native skeleton. Everything here is invented and static: nothing is
 * read from or written to the server yet. Screens that show it must show <SampleBadge />.
 * Shapes follow the web app's records loosely so the real data can replace this later.
 */

/** A fixed "today" so screens render the same every time (no Date.now in the skeleton). */
export const SAMPLE_TODAY = "2026-11-02"

export type SampleTask = {
  id: string
  title: string
  notes?: string
  done: boolean
  starred: boolean
  /** YYYY-MM-DD */
  due?: string
  /** HH:MM, 24h */
  time?: string
  courseId?: string
  subtasks?: { done: number; total: number }
}

export type CourseworkType = "assignment" | "exam" | "milestone" | "event"

export type SampleCourse = {
  id: string
  code: string
  name: string
  instructor: string
  term: string
  schedule: string
  credits: number
  /** Hex color for the course chip. */
  color: string
}

export type SampleCoursework = {
  id: string
  courseId: string
  type: CourseworkType
  title: string
  /** YYYY-MM-DD */
  due: string
  score?: string
  done: boolean
}

export type SampleEvent = {
  id: string
  title: string
  /** YYYY-MM-DD */
  date: string
  start: string
  end: string
  kind: "class" | "task" | "event"
}

export type SampleRepo = {
  id: string
  name: string
  branch: string
  status: "passing" | "failing"
  openPrs: number
  issues: number
  lastPush: string
}

export type SampleNote = { id: string; title: string; preview: string; color: string; pinned: boolean }

export const SAMPLE_COURSES: SampleCourse[] = [
  { id: "c1", code: "GEG-123", name: "Energy Resources", instructor: "Prof. Rivera", term: "Fall 2026", schedule: "Mon/Wed 10:00-11:15", credits: 3, color: "#74a7ff" },
  { id: "c2", code: "SPE-101", name: "Intro to Speech", instructor: "Prof. Okafor", term: "Fall 2026", schedule: "Tue/Thu 13:00-14:15", credits: 3, color: "#f2b84b" },
  { id: "c3", code: "ANT-101", name: "Intro to Anthropology", instructor: "Prof. Lindqvist", term: "Fall 2026", schedule: "Fri 09:00-11:45", credits: 3, color: "#6fcf97" },
]

export const SAMPLE_COURSEWORK: SampleCoursework[] = [
  { id: "w1", courseId: "c1", type: "assignment", title: "Lab report 4", due: "2026-11-04", done: false },
  { id: "w2", courseId: "c1", type: "exam", title: "Midterm exam", due: "2026-11-09", done: false },
  { id: "w3", courseId: "c2", type: "milestone", title: "Informative speech outline", due: "2026-11-05", done: false },
  { id: "w4", courseId: "c2", type: "event", title: "Speech day (informative)", due: "2026-11-12", done: false },
  { id: "w5", courseId: "c3", type: "assignment", title: "Vocabulary quiz 6", due: "2026-11-03", done: false },
  { id: "w6", courseId: "c3", type: "assignment", title: "Reading response 5", due: "2026-10-30", done: true, score: "18/20" },
  { id: "w7", courseId: "c1", type: "milestone", title: "Project proposal approved", due: "2026-10-28", done: true },
]

export const SAMPLE_TASKS: SampleTask[] = [
  { id: "t1", title: "Finish lab report 4", notes: "Graphs + conclusion", done: false, starred: true, due: "2026-11-04", courseId: "c1", subtasks: { done: 2, total: 4 } },
  { id: "t2", title: "Vocabulary quiz 6", done: false, starred: false, due: "2026-11-03", time: "23:59", courseId: "c3" },
  { id: "t3", title: "Outline informative speech", done: false, starred: true, due: "2026-11-05", courseId: "c2", subtasks: { done: 1, total: 3 } },
  { id: "t4", title: "Back up the homelab", done: false, starred: false, due: "2026-11-02", time: "18:00" },
  { id: "t5", title: "Review Codex pull request", done: false, starred: false, due: "2026-11-02" },
  { id: "t6", title: "Reading response 5", done: true, starred: false, due: "2026-10-30", courseId: "c3" },
  { id: "t7", title: "Renew domain", done: false, starred: false, due: "2026-10-31" },
]

export const SAMPLE_EVENTS: SampleEvent[] = [
  { id: "e1", title: "Energy Resources", date: "2026-11-02", start: "10:00", end: "11:15", kind: "class" },
  { id: "e2", title: "Back up the homelab", date: "2026-11-02", start: "18:00", end: "18:30", kind: "task" },
  { id: "e3", title: "Intro to Speech", date: "2026-11-03", start: "13:00", end: "14:15", kind: "class" },
  { id: "e4", title: "Study group", date: "2026-11-04", start: "16:00", end: "17:30", kind: "event" },
  { id: "e5", title: "Energy Resources", date: "2026-11-04", start: "10:00", end: "11:15", kind: "class" },
  { id: "e6", title: "Intro to Anthropology", date: "2026-11-06", start: "09:00", end: "11:45", kind: "class" },
]

export const SAMPLE_REPOS: SampleRepo[] = [
  { id: "r1", name: "bcndlabsadmin", branch: "main", status: "passing", openPrs: 2, issues: 5, lastPush: "2h ago" },
  { id: "r2", name: "vaultops", branch: "main", status: "failing", openPrs: 1, issues: 9, lastPush: "yesterday" },
  { id: "r3", name: "dragonwilds-dedicated-server-docker", branch: "main", status: "passing", openPrs: 0, issues: 1, lastPush: "3 weeks ago" },
]

export const SAMPLE_NOTES: SampleNote[] = [
  { id: "n1", title: "Homelab ideas", preview: "Move backups to a second disk, try n8n for update drops.", color: "#74a7ff", pinned: true },
  { id: "n2", title: "Speech topic", preview: "How a hydroelectric dam works: three points.", color: "#f2b84b", pinned: false },
  { id: "n3", title: "Grocery", preview: "Eggs, rice, coffee.", color: "#6fcf97", pinned: false },
]

export const SAMPLE_SITE = { visitors: 1284, pageviews: 3902, topPage: "/blog/self-sustainability-basics", range: "Last 7 days" }
export const SAMPLE_INSIGHTS = { completedThisWeek: 11, streakDays: 6, openTasks: 6, overdue: 1 }
