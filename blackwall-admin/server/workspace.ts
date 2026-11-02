import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import { emptyWorkspace, type Collections, type WorkspaceSnapshot } from "../shared/workspace.ts"

export interface WorkspaceStore {
  readWorkspace(): Promise<WorkspaceSnapshot>
  writeWorkspace(id: string, revision: number, data: Collections): Promise<WorkspaceSnapshot | null>
}

/** Development data has its own file, separate from connection credentials. */
export class FileWorkspaceStore implements WorkspaceStore {
  private readonly file: string
  private snapshot: WorkspaceSnapshot
  constructor(root: string) {
    const dir = path.join(root, ".blackwall")
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    this.file = path.join(dir, "workspace.json")
    this.snapshot = existsSync(this.file)
      ? JSON.parse(readFileSync(this.file, "utf8")) as WorkspaceSnapshot
      : { id: randomUUID(), revision: 0, data: emptyWorkspace() }
    if (!existsSync(this.file)) this.flush()
  }
  async readWorkspace() { return structuredClone(this.snapshot) }
  async writeWorkspace(id: string, revision: number, data: Collections) {
    if (this.snapshot.id !== id || this.snapshot.revision !== revision) return null
    const next = { id, revision: revision + 1, data: structuredClone(data) }
    this.flush(next)
    this.snapshot = next
    return structuredClone(next)
  }
  private flush(value = this.snapshot) {
    writeFileSync(`${this.file}.tmp`, JSON.stringify(value), { mode: 0o600 })
    renameSync(`${this.file}.tmp`, this.file)
  }
}
