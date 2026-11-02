import pg from "pg"
import { randomUUID } from "node:crypto"
import { emptyWorkspace, type Collections, type WorkspaceSnapshot } from "../shared/workspace.ts"
import { seal, unseal } from "./crypto.ts"
import type { ScheduledPost } from "../shared/site.ts"
import { ConnectionStore, type StoredConnection } from "./store.ts"

/**
 * Home-server backend. Secrets are encrypted (AES-256-GCM) before they reach
 * Postgres; everything else is plain so it's easy to inspect and back up.
 */
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS connections (
     id          text PRIMARY KEY,
     provider    text NOT NULL,
     label       text NOT NULL,
     config      jsonb NOT NULL DEFAULT '{}',
     secrets     text,
     status      text NOT NULL DEFAULT 'untested',
     account     text,
     message     text,
     summary     jsonb,
     checked_at  timestamptz,
     created_at  timestamptz NOT NULL DEFAULT now(),
     updated_at  timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS scheduled_posts (
     slug        text PRIMARY KEY,
     publish_at  timestamptz NOT NULL,
     data        jsonb NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS workspace (
     singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
     id text NOT NULL,
     revision bigint NOT NULL DEFAULT 0,
     data jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
]

interface Row {
  id: string
  provider: StoredConnection["provider"]
  label: string
  config: Record<string, string>
  secrets: string | null
  status: StoredConnection["status"]
  account: string | null
  message: string | null
  summary: StoredConnection["summary"] | null
  checked_at: Date | null
  created_at: Date
  updated_at: Date
}

export class PostgresConnectionStore extends ConnectionStore {
  readonly where: string
  private readonly pool: pg.Pool
  private readonly key: Buffer

  constructor(databaseUrl: string, key: Buffer) {
    super()
    this.pool = new pg.Pool({ connectionString: databaseUrl, max: 5 })
    this.key = key
    this.where = `postgres://${new URL(databaseUrl).host}${new URL(databaseUrl).pathname}`
  }

  /** Create or upgrade tables. Safe to run on every start. */
  async migrate() {
    const client = await this.pool.connect()
    try {
      await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())")
      const { rows } = await client.query<{ v: number | null }>("SELECT max(version) AS v FROM schema_migrations")
      for (let v = (rows[0].v ?? 0) + 1; v <= MIGRATIONS.length; v++) {
        await client.query("BEGIN")
        await client.query(MIGRATIONS[v - 1])
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [v])
        await client.query("COMMIT")
      }
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {})
      throw e
    } finally {
      client.release()
    }
  }

  async readWorkspace(): Promise<WorkspaceSnapshot> {
    await this.pool.query(
      "INSERT INTO workspace (singleton, id, data) VALUES (true, $1, $2) ON CONFLICT (singleton) DO NOTHING",
      [randomUUID(), JSON.stringify(emptyWorkspace())],
    )
    const { rows } = await this.pool.query("SELECT id, revision, data FROM workspace WHERE singleton = true")
    return { ...rows[0], revision: Number(rows[0].revision) }
  }

  async writeWorkspace(id: string, revision: number, data: Collections): Promise<WorkspaceSnapshot | null> {
    // Compare-and-swap is atomic across processes and devices: no stale snapshot can overwrite a newer one.
    const { rows } = await this.pool.query(
      `UPDATE workspace SET data = $3, revision = revision + 1, updated_at = now()
       WHERE singleton = true AND id = $1 AND revision = $2 RETURNING id, revision, data`,
      [id, revision, JSON.stringify(data)],
    )
    return rows.length ? { ...rows[0], revision: Number(rows[0].revision) } : null
  }

  async ping() {
    await this.pool.query("SELECT 1")
  }

  close() {
    return this.pool.end()
  }

  protected async all() {
    const { rows } = await this.pool.query<Row>("SELECT * FROM connections ORDER BY created_at")
    return rows.map((r) => this.fromRow(r))
  }

  protected async save(c: StoredConnection) {
    await this.pool.query(
      `INSERT INTO connections (id, provider, label, config, secrets, status, account, message, summary, checked_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label, config = EXCLUDED.config, secrets = EXCLUDED.secrets, status = EXCLUDED.status,
         account = EXCLUDED.account, message = EXCLUDED.message, summary = EXCLUDED.summary,
         checked_at = EXCLUDED.checked_at, updated_at = EXCLUDED.updated_at`,
      [
        c.id,
        c.provider,
        c.label,
        JSON.stringify(c.config),
        Object.keys(c.secrets).length ? seal(this.key, JSON.stringify(c.secrets)) : null,
        c.status,
        c.account ?? null,
        c.message ?? null,
        c.summary ? JSON.stringify(c.summary) : null,
        c.checkedAt ?? null,
        c.createdAt,
        c.updatedAt,
      ],
    )
  }

  protected async delete(id: string) {
    const r = await this.pool.query("DELETE FROM connections WHERE id = $1", [id])
    return (r.rowCount ?? 0) > 0
  }

  async listSchedules() {
    const { rows } = await this.pool.query<{ data: ScheduledPost }>("SELECT data FROM scheduled_posts ORDER BY publish_at")
    return rows.map((r) => r.data)
  }

  async putSchedule(s: ScheduledPost) {
    await this.pool.query(
      `INSERT INTO scheduled_posts (slug, publish_at, data) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET publish_at = EXCLUDED.publish_at, data = EXCLUDED.data`,
      [s.post.slug, s.publishAt, JSON.stringify(s)],
    )
  }

  async deleteSchedule(slug: string) {
    const r = await this.pool.query("DELETE FROM scheduled_posts WHERE slug = $1", [slug])
    return (r.rowCount ?? 0) > 0
  }

  private fromRow(r: Row): StoredConnection {
    return {
      id: r.id,
      provider: r.provider,
      label: r.label,
      config: r.config ?? {},
      secrets: r.secrets ? JSON.parse(unseal(this.key, r.secrets)) : {},
      status: r.status,
      account: r.account ?? undefined,
      message: r.message ?? undefined,
      summary: r.summary ?? undefined,
      checkedAt: r.checked_at?.toISOString(),
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }
  }
}
