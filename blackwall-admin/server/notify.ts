import { randomUUID } from "node:crypto"
import { DEFAULT_NOTIFY_SETTINGS, NOTIFY_EVENTS, channelsFor, sanitizeNotifySettings, type FeedItem, type NotifyChannel, type NotifySettings } from "../shared/notifications.ts"
import type { Collections } from "../shared/workspace.ts"
import type { DevelopmentOverview } from "../shared/connections.ts"
import { sendEmail, sendNtfy, type Outgoing } from "./providers/channels.ts"
import type { ServiceStatus } from "./service-status.ts"
import type { ConnectionStore, StoredConnection } from "./store.ts"

const FEED_MAX = 200
const GITHUB_EVERY_MS = 5 * 60_000
const UPDATE_EVERY_MS = 6 * 3600_000

interface Memory {
  services: Record<string, { up: boolean; fails: number; name: string }>
  servicesSeeded?: boolean
  connections: Record<string, string>
  connectionsSeeded?: boolean
  github: { reviews: string[]; failures: string[]; merges: string[] }
  githubSeeded?: boolean
  githubAt?: number
  backupAt?: string
  backupOverdueDay?: string
  digestDay?: string
  examsSent: string[]
  siteFailed: string[]
  /** Social posts already reminded about ("id@scheduledAt"). */
  socialSent?: string[]
  updateTree?: string
  updateAt?: number
  /** Last delivery problem per channel, shown in Settings → Notifications. */
  deliveryErrors: Partial<Record<NotifyChannel, { at: string; message: string }>>
}

const emptyMemory = (): Memory => ({ services: {}, connections: {}, github: { reviews: [], failures: [], merges: [] }, examsSent: [], siteFailed: [], deliveryErrors: {} })

export interface NotifierDeps {
  store: ConnectionStore
  readWorkspace: () => Promise<{ data: Collections }>
  checkServices: (urls: string[]) => Promise<ServiceStatus[]>
  githubOverview?: (c: StoredConnection, repos: string[]) => Promise<DevelopmentOverview>
  readBackups?: () => { configured: boolean; status?: unknown }
  checkUpdate?: () => Promise<{ upToDate: boolean; latest: { tree: string; message: string } }>
  /** Public address of Blackwall, for links in pushes and emails. */
  baseUrl?: string
  now?: () => number
  sendNtfy?: typeof sendNtfy
  sendEmail?: typeof sendEmail
}

/** "2026-11-02" in the given time zone. */
export function localDay(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms)
}
const localHour = (ms: number, timeZone: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(ms))
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * The notification engine: watches services, backups, connections, GitHub, due work and
 * scheduled posts, turns changes into notifications, keeps the bell feed and delivers
 * pushes and emails per your settings. First sight of anything is recorded quietly, so
 * starting up never floods you.
 */
export class Notifier {
  private readonly d: NotifierDeps
  private memory?: Memory
  private running = false

  constructor(deps: NotifierDeps) {
    this.d = deps
  }

  private now() {
    return this.d.now?.() ?? Date.now()
  }

  async settings(): Promise<NotifySettings> {
    return sanitizeNotifySettings((await this.d.store.getState("notify.settings")) ?? DEFAULT_NOTIFY_SETTINGS)
  }
  async saveSettings(raw: unknown) {
    const s = sanitizeNotifySettings(raw)
    await this.d.store.putState("notify.settings", s)
    return s
  }
  async feed(): Promise<FeedItem[]> {
    return (await this.d.store.getState<FeedItem[]>("notify.feed")) ?? []
  }
  async markRead(ids: string[] | "all") {
    const feed = (await this.feed()).map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n))
    await this.d.store.putState("notify.feed", feed)
    return feed
  }
  async deliveryErrors() {
    return (await this.mem()).deliveryErrors
  }

  private async mem(): Promise<Memory> {
    if (!this.memory) this.memory = { ...emptyMemory(), ...((await this.d.store.getState<Memory>("notify.memory")) ?? {}) }
    return this.memory
  }
  private async saveMem() {
    if (this.memory) await this.d.store.putState("notify.memory", this.memory)
  }

  /** Record and deliver one notification. Returns the channels it went to. */
  async emit(event: string, m: Outgoing, opts: { force?: NotifyChannel[] } = {}): Promise<NotifyChannel[]> {
    const def = NOTIFY_EVENTS.find((e) => e.id === event)
    const channels = opts.force ?? channelsFor(await this.settings(), event)
    // Links like "/cms/forms" become full addresses for pushes and emails.
    const url = m.url?.startsWith("/") ? (this.d.baseUrl ? `${this.d.baseUrl}${m.url}` : undefined) : (m.url ?? this.d.baseUrl)
    const sent: NotifyChannel[] = []
    if (channels.includes("bell")) {
      const item: FeedItem = { id: randomUUID(), event, group: def?.group ?? "server", title: m.title, body: m.body, url: m.url, at: new Date(this.now()).toISOString(), read: false }
      await this.d.store.putState("notify.feed", [item, ...(await this.feed())].slice(0, FEED_MAX))
      sent.push("bell")
    }
    const mem = await this.mem()
    for (const ch of ["ntfy", "email"] as const) {
      if (!channels.includes(ch)) continue
      const c = await this.d.store.firstOk(ch)
      if (!c) continue
      try {
        await (ch === "ntfy" ? (this.d.sendNtfy ?? sendNtfy) : (this.d.sendEmail ?? sendEmail))(c, { ...m, url })
        delete mem.deliveryErrors[ch]
        sent.push(ch)
      } catch (e) {
        mem.deliveryErrors[ch] = { at: new Date(this.now()).toISOString(), message: (e as Error).message }
      }
    }
    await this.saveMem()
    return sent
  }

  /** One pass over every source. Called every minute; overlapping runs are skipped. */
  async tick() {
    if (this.running) return
    this.running = true
    try {
      const ws = (await this.d.readWorkspace()).data
      const settings = await this.settings()
      await this.watchServices(ws)
      await this.watchBackups()
      await this.watchConnections()
      await this.watchGitHub(ws)
      await this.dailyWork(ws, settings)
      await this.watchSocial(ws)
      await this.watchUpdates()
      await this.saveMem()
    } finally {
      this.running = false
    }
  }

  private async watchServices(ws: Collections) {
    const mem = await this.mem()
    const services = ws.services ?? []
    if (!services.length) return
    const results = await this.d.checkServices([...new Set(services.map((s) => s.url))].slice(0, 60))
    const seeded = mem.servicesSeeded
    for (const r of results) {
      const name = services.find((s) => s.url === r.url)?.name ?? r.url
      const prev = mem.services[r.url]
      const fails = r.up ? 0 : (prev?.fails ?? 0) + 1
      // Down only after two failed checks in a row, so one slow answer doesn't page you.
      const up = r.up ? true : fails >= 2 ? false : prev?.up ?? true
      if (seeded && prev) {
        if (prev.up && !up) await this.emit("service.down", { title: `${name} is down`, body: `${name} hasn't answered for 2 minutes${r.error ? ` (${r.error})` : r.status ? ` (HTTP ${r.status})` : ""}.`, url: r.url, priority: 4, tags: ["red_circle"] })
        if (!prev.up && up) await this.emit("service.up", { title: `${name} is back`, body: `${name} is answering again${r.ms != null ? ` (${r.ms} ms)` : ""}.`, url: r.url, tags: ["green_circle"] })
      }
      mem.services[r.url] = { up, fails, name }
    }
    for (const url of Object.keys(mem.services)) if (!results.some((r) => r.url === url)) delete mem.services[url]
    mem.servicesSeeded = true
  }

  private async watchBackups() {
    const info = this.d.readBackups?.()
    if (!info?.configured) return
    const mem = await this.mem()
    const last = info.status as { at?: string; ok?: boolean; error?: string } | undefined
    if (last?.at && last.at !== mem.backupAt) {
      if (mem.backupAt && last.ok === false) await this.emit("backup.failed", { title: "Backup failed", body: last.error ? `The nightly backup failed: ${last.error}` : "The nightly backup failed.", priority: 4, tags: ["floppy_disk", "warning"] })
      mem.backupAt = last.at
    }
    const lastOk = last?.ok ? Date.parse(last.at ?? "") : NaN
    const day = new Date(this.now()).toISOString().slice(0, 10)
    if (Number.isFinite(lastOk) && this.now() - lastOk > 36 * 3600_000 && mem.backupOverdueDay !== day) {
      mem.backupOverdueDay = day
      await this.emit("backup.overdue", { title: "Backup overdue", body: `The last successful backup was ${Math.round((this.now() - lastOk) / 3600_000)} hours ago.`, tags: ["floppy_disk"] })
    }
  }

  private async watchConnections() {
    const mem = await this.mem()
    const list = await this.d.store.list()
    for (const c of list) {
      const prev = mem.connections[c.id]
      if (mem.connectionsSeeded && prev && prev !== "error" && c.status === "error") {
        await this.emit("connection.error", { title: `${c.label} needs attention`, body: c.message ?? "Its last test failed. Open Settings → Connections to fix it.", tags: ["electric_plug"] })
      }
      mem.connections[c.id] = c.status
    }
    mem.connectionsSeeded = true
  }

  private async watchGitHub(ws: Collections) {
    const mem = await this.mem()
    if (!this.d.githubOverview || (mem.githubAt && this.now() - mem.githubAt < GITHUB_EVERY_MS)) return
    mem.githubAt = this.now()
    const ok = (await this.d.store.list()).filter((c) => c.provider === "github" && c.status === "ok")
    if (!ok.length || !ws.repos.length) return
    const assigned = new Map<string, string[]>(ok.map((c) => [c.id, []]))
    for (const r of ws.repos) assigned.get(r.connectionId && assigned.has(r.connectionId) ? r.connectionId : ok[0].id)!.push(r.fullName)
    const seen = { reviews: new Set(mem.github.reviews), failures: new Set(mem.github.failures), merges: new Set(mem.github.merges) }
    const fresh: { reviews: string[]; failures: string[]; merges: string[] } = { reviews: [], failures: [], merges: [] }
    for (const c of ok) {
      const repos = assigned.get(c.id)!
      if (!repos.length) continue
      let o: DevelopmentOverview
      try {
        o = await this.d.githubOverview(c, repos)
      } catch {
        continue
      }
      for (const p of o.prs.filter((p) => p.kind === "review-requested")) {
        fresh.reviews.push(p.id)
        if (mem.githubSeeded && !seen.reviews.has(p.id)) await this.emit("github.review", { title: `Review requested: ${p.title}`, body: `${p.author} asked you to review ${p.repo} #${p.number}.`, url: p.url, tags: ["eyes"] })
      }
      for (const f of o.failures) {
        fresh.failures.push(f.id)
        if (mem.githubSeeded && !seen.failures.has(f.id)) await this.emit("github.ci_failed", { title: `CI failed: ${f.repo}`, body: `${f.workflow} failed on ${f.branch}${f.commit ? `: ${f.commit}` : ""}.`, url: f.url, priority: 4, tags: ["x"] })
      }
      for (const a of o.activity.filter((a) => a.kind === "merge")) {
        fresh.merges.push(a.id)
        if (mem.githubSeeded && !seen.merges.has(a.id)) await this.emit("github.merged", { title: `Merged in ${a.repo}`, body: a.summary, url: a.url, tags: ["twisted_rightwards_arrows"] })
      }
    }
    // Keep what's still open plus recent history, so a PR that reappears isn't re-announced.
    const keep = (now: string[], before: string[]) => [...new Set([...now, ...before])].slice(0, 300)
    mem.github = { reviews: keep(fresh.reviews, mem.github.reviews), failures: keep(fresh.failures, mem.github.failures), merges: keep(fresh.merges, mem.github.merges) }
    mem.githubSeeded = true
  }

  private async dailyWork(ws: Collections, settings: NotifySettings) {
    const mem = await this.mem()
    const now = this.now()
    const today = localDay(now, settings.timeZone)
    if (mem.digestDay === today || localHour(now, settings.timeZone) < settings.digestHour) return
    mem.digestDay = today
    const open = ws.tasks.filter((t) => !t.done && t.due)
    const due = open.filter((t) => t.due === today)
    const overdue = open.filter((t) => t.due! < today)
    if (due.length || overdue.length) {
      const names = [...overdue, ...due].slice(0, 4).map((t) => `• ${t.title}${t.due! < today ? " (overdue)" : ""}`)
      await this.emit("work.digest", {
        title: [due.length && `${plural(due.length, "item")} due today`, overdue.length && `${overdue.length} overdue`].filter(Boolean).join(", "),
        body: names.join("\n") + (due.length + overdue.length > 4 ? `\n…and ${due.length + overdue.length - 4} more` : ""),
        url: this.d.baseUrl ? `${this.d.baseUrl}/productivity` : undefined,
        tags: ["spiral_calendar"],
      })
    }
    for (const c of ws.courses.filter((c) => c.kind === "certification" && c.endDate)) {
      const left = daysBetween(today, c.endDate!)
      const key = `${c.id}:${left}`
      if ((left === 7 || left === 1) && !mem.examsSent.includes(key)) {
        mem.examsSent = [key, ...mem.examsSent].slice(0, 100)
        await this.emit("work.exam_soon", { title: `${c.title} exam ${left === 1 ? "tomorrow" : "in a week"}`, body: `Your ${c.title} exam is on ${c.endDate}.`, url: this.d.baseUrl ? `${this.d.baseUrl}/productivity/learning/${c.id}` : undefined, priority: 4, tags: ["mortar_board"] })
      }
    }
  }

  /** A scheduled social post's time came and it isn't posted everywhere yet: remind once. Long-past ones are skipped quietly. */
  private async watchSocial(ws: Collections) {
    const mem = await this.mem()
    const sent = new Set(mem.socialSent ?? [])
    const now = this.now()
    for (const p of ws.socialPosts ?? []) {
      if (!p.scheduledAt || Date.parse(p.scheduledAt) > now) continue
      const key = `${p.id}@${p.scheduledAt}`
      if (sent.has(key)) continue
      sent.add(key)
      const left = p.accountIds.filter((a) => !p.posted.some((x) => x.accountId === a))
      if (!left.length || now - Date.parse(p.scheduledAt) > 2 * 3600_000) continue
      const names = ws.socialAccounts.filter((a) => left.includes(a.id)).map((a) => `${a.name} (${a.platform})`)
      await this.emit("social.due", { title: `Time to post: ${p.title || "Untitled post"}`, body: names.length ? `Post to ${names.join(", ")}.` : "It's time to post this.", url: `/social/${p.id}`, priority: 4, tags: ["mega"] })
    }
    mem.socialSent = [...sent].slice(-300)
  }

  private async watchUpdates() {
    const mem = await this.mem()
    if (!this.d.checkUpdate || (mem.updateAt && this.now() - mem.updateAt < UPDATE_EVERY_MS)) return
    mem.updateAt = this.now()
    try {
      const r = await this.d.checkUpdate()
      if (!r.upToDate && r.latest.tree !== mem.updateTree) {
        mem.updateTree = r.latest.tree
        await this.emit("system.update", { title: "Blackwall update available", body: r.latest.message.split("\n")[0], url: this.d.baseUrl, tags: ["arrow_up"] })
      }
    } catch {
      // Update checks are best-effort.
    }
  }

  /** Called by the scheduled-post publisher. */
  async sitePublished(title: string) {
    await this.emit("site.published", { title: "Post published", body: `“${title}” is live.`, tags: ["newspaper"] })
  }
  async siteFailed(slug: string, title: string, error: string) {
    const mem = await this.mem()
    if (mem.siteFailed.includes(slug)) return
    mem.siteFailed = [slug, ...mem.siteFailed].slice(0, 50)
    await this.emit("site.failed", { title: "Scheduled post failed", body: `“${title}” didn't publish: ${error}. Blackwall retries every 10 minutes.`, priority: 4, tags: ["warning"] })
  }
  async siteCleared(slug: string) {
    const mem = await this.mem()
    mem.siteFailed = mem.siteFailed.filter((s) => s !== slug)
  }
}
