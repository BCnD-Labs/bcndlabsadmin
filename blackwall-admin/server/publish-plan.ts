import { createHash } from "node:crypto"
import type { PlanFile, PublishPlan } from "../shared/publish-plan.ts"
import { ProviderError } from "./http.ts"
import type { Change, Repo } from "./providers/website.ts"

export type { PlanFile, PublishPlan }

export interface DeliverOptions {
  mode?: "direct" | "pr"
  /** Only work out what would change. */
  plan?: boolean
  expectedHead?: string
  /** Files the owner agreed to replace (see `conflict`). */
  acknowledge?: string[]
}

export interface Delivered {
  plan: PublishPlan
  /** Absent when asked for a plan only, or when nothing would change. */
  committed?: { sha: string; branch: string; pr?: { url: string; number: number } }
}

/** What git itself calls a file's fingerprint, so a file can be compared with the repository's without reading it. */
export const gitBlobSha = (content: string | Buffer) => {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8")
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")
}

const TEXT = /\.(html?|css|js|mjs|json|xml|txt|md|svg|webmanifest)$|(^|\/)(_redirects|robots\.txt)$/i
const SHOW_LIMIT = 24
const SHOW_BYTES = 20_000

/**
 * Works out what publishing `changes` would do to the repository, without writing anything.
 * `owned` maps each file Blackwall made before to the fingerprint it wrote (or "" when that isn't known); a file outside it that
 * already exists is the owner's, and so is a file whose fingerprint no longer matches what Blackwall wrote.
 */
export async function planChanges(repo: Repo, changes: Change[], owned: ReadonlyMap<string, string>): Promise<PublishPlan> {
  const [head, blobs] = await Promise.all([repo.head(), repo.blobs()])
  const files: PlanFile[] = []
  let unchanged = 0
  for (const c of changes) {
    const there = blobs.get(c.path)
    if ("delete" in c) {
      if (there === undefined) continue
      files.push({ path: c.path, status: "removed", conflict: conflictOf(c.path, there, owned) })
      continue
    }
    const sha = gitBlobSha(c.content)
    if (there === sha) { unchanged++; continue }
    files.push({ path: c.path, status: there === undefined ? "added" : "changed", conflict: there === undefined ? undefined : conflictOf(c.path, there, owned), after: typeof c.content === "string" ? c.content : undefined })
  }
  let shown = 0
  for (const f of files) {
    const text = TEXT.test(f.path)
    if (!text || shown >= SHOW_LIMIT) { f.hidden = true; delete f.after; continue }
    shown++
    if (f.status !== "added") {
      const before = await repo.read(f.path).catch(() => null)
      if (before !== null) f.before = before
    }
    if (f.status === "removed") { /* nothing after */ }
    else if (f.after === undefined || f.after.length > SHOW_BYTES) { f.hidden = true; delete f.after; delete f.before }
    if (f.before !== undefined && f.before.length > SHOW_BYTES) { f.hidden = true; delete f.before; delete f.after }
  }
  return { head, files, unchanged }
}

function conflictOf(path: string, there: string, owned: ReadonlyMap<string, string>): PlanFile["conflict"] {
  if (!owned.has(path)) return "not-blackwalls"
  const wrote = owned.get(path)
  return wrote && wrote !== there ? "edited-elsewhere" : undefined
}

/**
 * The one way Blackwall puts files in a repository: plan first, refuse to replace anything the owner made or changed unless they said
 * yes, refuse if the branch moved since they reviewed, and either commit to the branch or open a pull request.
 */
export async function deliver(repo: Repo, message: string, changes: Change[], owned: ReadonlyMap<string, string>, opts: DeliverOptions = {}, pr?: { title: string; body: string }): Promise<Delivered> {
  const plan = await planChanges(repo, changes, owned)
  if (opts.plan) return { plan }
  const need = plan.files.filter((f) => f.conflict && !(opts.acknowledge ?? []).includes(f.path))
  if (need.length) {
    const names = need.slice(0, 5).map((f) => `${f.path} (${f.conflict === "edited-elsewhere" ? "edited since Blackwall wrote it" : "not made by Blackwall"})`).join(", ")
    throw new ProviderError(`Publishing would replace ${need.length} file${need.length === 1 ? "" : "s"} that ${need.length === 1 ? "isn't" : "aren't"} Blackwall's to replace: ${names}${need.length > 5 ? ", …" : ""}. Nothing was written; review the changes and agree to replace them, or change them in the repository.`, 409)
  }
  if (!plan.files.length) return { plan }
  if (opts.mode === "pr") {
    const branch = `blackwall/${new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")}`
    const done = await repo.commitTo(message, changes, { branch })
    const made = await repo.createPullRequest(pr?.title ?? message, branch, pr?.body ?? "Changes made with Blackwall.")
    return { plan, committed: { ...done, pr: made } }
  }
  return { plan, committed: await repo.commitTo(message, changes, { expectedHead: opts.expectedHead ?? plan.head }) }
}
