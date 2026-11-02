/**
 * Everything Blackwall can notify you about, and how each is delivered. The server
 * produces them (so pushes and emails arrive with Blackwall closed); the bell shows
 * the same feed. Settings → Notifications chooses channels per event.
 */
export type NotifyChannel = "bell" | "ntfy" | "email"
export type NotifyGroup = "server" | "dev" | "work" | "site"

export interface NotifyEventDef {
  id: string
  group: NotifyGroup
  label: string
  description: string
  /** Channels on until you change them. */
  defaults: NotifyChannel[]
}

export const NOTIFY_GROUP_LABEL: Record<NotifyGroup, string> = { server: "Services & server", dev: "GitHub", work: "Due work", site: "Website" }

export const NOTIFY_EVENTS: NotifyEventDef[] = [
  { id: "service.down", group: "server", label: "Service went down", description: "A Mikoshi launcher service stopped answering (two checks in a row).", defaults: ["bell", "ntfy"] },
  { id: "service.up", group: "server", label: "Service is back", description: "A service that was down answers again.", defaults: ["bell", "ntfy"] },
  { id: "backup.failed", group: "server", label: "Backup failed", description: "The nightly backup job reported a failure.", defaults: ["bell", "ntfy", "email"] },
  { id: "backup.overdue", group: "server", label: "Backup overdue", description: "No successful backup in the last 36 hours.", defaults: ["bell", "email"] },
  { id: "connection.error", group: "server", label: "Connection needs attention", description: "A linked service (GitHub, Nextcloud, analytics…) started failing.", defaults: ["bell"] },
  { id: "system.update", group: "server", label: "Blackwall update available", description: "A newer version of Blackwall is ready to install.", defaults: ["bell"] },
  { id: "github.review", group: "dev", label: "Review requested", description: "Someone asked you to review a pull request.", defaults: ["bell", "ntfy"] },
  { id: "github.ci_failed", group: "dev", label: "CI failed", description: "A workflow run failed on a tracked repository.", defaults: ["bell", "ntfy"] },
  { id: "github.merged", group: "dev", label: "Pull request merged", description: "A pull request was merged in a tracked repository.", defaults: ["bell"] },
  { id: "work.digest", group: "work", label: "Daily summary", description: "Each morning: tasks and coursework due today and anything overdue.", defaults: ["bell", "ntfy"] },
  { id: "work.exam_soon", group: "work", label: "Exam coming up", description: "A certification exam is 7 days or 1 day away.", defaults: ["bell", "ntfy", "email"] },
  { id: "site.published", group: "site", label: "Scheduled post published", description: "A post you scheduled went live.", defaults: ["bell"] },
  { id: "site.failed", group: "site", label: "Scheduled post failed", description: "A scheduled post couldn't publish (Blackwall keeps retrying).", defaults: ["bell", "ntfy", "email"] },
]

export interface NotifySettings {
  /** Per event: which channels are on. Missing events use their defaults. */
  rules: Record<string, NotifyChannel[]>
  /** Hour (0–23, local time) the daily summary is sent. */
  digestHour: number
  /** IANA time zone for the daily summary and "due today", e.g. America/Chicago. */
  timeZone: string
}

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = { rules: {}, digestHour: 8, timeZone: "UTC" }

export interface FeedItem {
  id: string
  event: string
  group: NotifyGroup
  title: string
  body: string
  url?: string
  at: string
  read: boolean
}

export function channelsFor(settings: NotifySettings, event: string): NotifyChannel[] {
  return settings.rules[event] ?? NOTIFY_EVENTS.find((e) => e.id === event)?.defaults ?? ["bell"]
}

export function sanitizeNotifySettings(raw: unknown): NotifySettings {
  const r = (raw ?? {}) as Partial<NotifySettings>
  const rules: Record<string, NotifyChannel[]> = {}
  for (const e of NOTIFY_EVENTS) {
    const v = r.rules?.[e.id]
    if (Array.isArray(v)) rules[e.id] = [...new Set(v.filter((c): c is NotifyChannel => c === "bell" || c === "ntfy" || c === "email"))]
  }
  const hour = Number(r.digestHour)
  let tz = typeof r.timeZone === "string" ? r.timeZone : "UTC"
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz })
  } catch {
    tz = "UTC"
  }
  return { rules, digestHour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 8, timeZone: tz }
}
