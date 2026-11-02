import { randomUUID } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { ConnectionInput, PublicConnection } from "../shared/connections.ts"
import type { ScheduledPost } from "../shared/site.ts"

/** A connection as the server holds it, secrets in the clear (in memory only). */
export interface StoredConnection extends Omit<PublicConnection, "secrets"> {
  secrets: Record<string, string>
}

export type TestOutcome = Pick<StoredConnection, "status" | "account" | "message" | "summary">

/**
 * Where connections live. Two backends share all the record logic below:
 * a local JSON file for development, and Postgres on the home server.
 */
export abstract class ConnectionStore {
  /** Human-readable location, shown by /api/health. */
  abstract readonly where: string
  protected abstract all(): Promise<StoredConnection[]>
  protected abstract save(c: StoredConnection): Promise<void>
  protected abstract delete(id: string): Promise<boolean>
  /** Posts waiting to be published at a set time (CMS → Schedule). Keyed by slug. */
  abstract listSchedules(): Promise<ScheduledPost[]>
  abstract putSchedule(s: ScheduledPost): Promise<void>
  abstract deleteSchedule(slug: string): Promise<boolean>
  /** Service logos (Mikoshi launcher): an SVG copy kept so tiles work without the CDN. */
  abstract getIcon(slug: string): Promise<string | undefined>
  abstract putIcon(slug: string, svg: string): Promise<void>

  list() {
    return this.all()
  }

  async get(id: string) {
    return (await this.all()).find((c) => c.id === id)
  }

  async firstOk(provider: StoredConnection["provider"]) {
    const all = (await this.all()).filter((c) => c.provider === provider)
    return all.find((c) => c.status === "ok") ?? all[0]
  }

  async create(input: ConnectionInput) {
    const now = new Date().toISOString()
    const c: StoredConnection = {
      id: randomUUID().slice(0, 8),
      provider: input.provider,
      label: input.label.trim() || input.provider,
      config: clean(input.config),
      secrets: {},
      status: "untested",
      createdAt: now,
      updatedAt: now,
    }
    applySecrets(c, input.secrets)
    await this.save(c)
    return c
  }

  async update(id: string, input: Partial<ConnectionInput>) {
    const c = await this.get(id)
    if (!c) return undefined
    if (input.label !== undefined) c.label = input.label.trim() || c.label
    if (input.config) c.config = clean(input.config)
    applySecrets(c, input.secrets)
    c.status = "untested"
    c.message = undefined
    c.updatedAt = new Date().toISOString()
    await this.save(c)
    return c
  }

  async setResult(id: string, result: TestOutcome) {
    const c = await this.get(id)
    if (!c) return undefined
    Object.assign(c, result, { checkedAt: new Date().toISOString() })
    await this.save(c)
    return c
  }

  remove(id: string) {
    return this.delete(id)
  }
}

/** Development backend: `.blackwall/connections.json` next to the app (gitignored, mode 600). */
export class FileConnectionStore extends ConnectionStore {
  readonly where: string
  private data: { version: 1; connections: StoredConnection[]; schedules?: ScheduledPost[]; icons?: Record<string, string> }

  constructor(root: string) {
    super()
    const dir = path.join(root, ".blackwall")
    this.where = path.join(dir, "connections.json")
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
    this.data = existsSync(this.where) ? JSON.parse(readFileSync(this.where, "utf8")) : { version: 1, connections: [] }
  }

  protected async all() {
    return this.data.connections
  }

  protected async save(c: StoredConnection) {
    const i = this.data.connections.findIndex((x) => x.id === c.id)
    if (i >= 0) this.data.connections[i] = c
    else this.data.connections.push(c)
    this.flush()
  }

  protected async delete(id: string) {
    const before = this.data.connections.length
    this.data.connections = this.data.connections.filter((c) => c.id !== id)
    if (this.data.connections.length === before) return false
    this.flush()
    return true
  }

  async listSchedules() {
    return [...(this.data.schedules ?? [])]
  }

  async putSchedule(s: ScheduledPost) {
    this.data.schedules = [...(this.data.schedules ?? []).filter((x) => x.post.slug !== s.post.slug), s]
    this.flush()
  }

  async deleteSchedule(slug: string) {
    const before = this.data.schedules?.length ?? 0
    this.data.schedules = (this.data.schedules ?? []).filter((x) => x.post.slug !== slug)
    if (this.data.schedules.length === before) return false
    this.flush()
    return true
  }

  async getIcon(slug: string) {
    return this.data.icons?.[slug]
  }

  async putIcon(slug: string, svg: string) {
    this.data.icons = { ...(this.data.icons ?? {}), [slug]: svg }
    this.flush()
  }

  private flush() {
    const tmp = `${this.where}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 })
    renameSync(tmp, this.where)
    chmodSync(this.where, 0o600)
  }
}

function clean(config: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(config)
      .map(([k, v]) => [k, String(v ?? "").trim()])
      .filter(([, v]) => v !== ""),
  )
}

function applySecrets(c: StoredConnection, secrets?: Record<string, string | null>) {
  for (const [k, v] of Object.entries(secrets ?? {})) {
    if (v === null) delete c.secrets[k]
    else if (v.trim()) c.secrets[k] = v.trim()
  }
}

export function toPublic(c: StoredConnection): PublicConnection {
  return {
    ...c,
    secrets: Object.fromEntries(
      Object.entries(c.secrets).map(([k, v]) => [k, { set: true, hint: v.length > 8 ? `…${v.slice(-4)}` : undefined }]),
    ),
  }
}
