import { randomUUID } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { ConnectionInput, PublicConnection } from "../shared/connections.ts"

/**
 * Connections, including secrets, live in `.blackwall/connections.json` next to
 * the app (gitignored, file mode 600). Only this server process reads secrets;
 * the browser gets redacted copies.
 */
export interface StoredConnection extends Omit<PublicConnection, "secrets"> {
  secrets: Record<string, string>
}

interface StoreFile {
  version: 1
  connections: StoredConnection[]
}

export class ConnectionStore {
  readonly file: string
  private data: StoreFile

  constructor(root: string) {
    const dir = path.join(root, ".blackwall")
    this.file = path.join(dir, "connections.json")
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
    this.data = existsSync(this.file)
      ? (JSON.parse(readFileSync(this.file, "utf8")) as StoreFile)
      : { version: 1, connections: [] }
  }

  private save() {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 })
    renameSync(tmp, this.file)
    chmodSync(this.file, 0o600)
  }

  list() {
    return this.data.connections
  }

  get(id: string) {
    return this.data.connections.find((c) => c.id === id)
  }

  firstOk(provider: StoredConnection["provider"]) {
    const all = this.data.connections.filter((c) => c.provider === provider)
    return all.find((c) => c.status === "ok") ?? all[0]
  }

  create(input: ConnectionInput) {
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
    this.data.connections.push(c)
    this.save()
    return c
  }

  update(id: string, input: Partial<ConnectionInput>) {
    const c = this.get(id)
    if (!c) return undefined
    if (input.label !== undefined) c.label = input.label.trim() || c.label
    if (input.config) c.config = clean(input.config)
    applySecrets(c, input.secrets)
    c.status = "untested"
    c.message = undefined
    c.updatedAt = new Date().toISOString()
    this.save()
    return c
  }

  setResult(id: string, result: Pick<StoredConnection, "status" | "account" | "message" | "summary">) {
    const c = this.get(id)
    if (!c) return undefined
    Object.assign(c, result, { checkedAt: new Date().toISOString() })
    this.save()
    return c
  }

  remove(id: string) {
    const before = this.data.connections.length
    this.data.connections = this.data.connections.filter((c) => c.id !== id)
    if (this.data.connections.length !== before) this.save()
    return this.data.connections.length !== before
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
