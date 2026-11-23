import { createHash } from "node:crypto"
import type { PlanFile, PlanText, PlanWarning, PublishPlan, PublishTarget } from "../shared/publish-plan.ts"
import { ProviderError } from "./http.ts"
import type { Change, Repo } from "./providers/website.ts"

export type { PlanFile, PublishPlan }

export interface DeliverOptions {
  mode?: "direct" | "pr"
  /** Only work out what would change. */
  plan?: boolean
  expectedHead?: string
  /** The reviewed plan being confirmed (see `PublishPlan.token`). A write without it is refused. */
  token?: string
  /** What the owner wrote on the review screen. */
  message?: string
  prTitle?: string
  prBody?: string
  branch?: string
  /** The time the reviewed plan was built with. Plans report it; a write sends it back (see `PublishPlan.stamp`). */
  stamp?: string
  /** Files the owner agreed to replace (see `conflict`). */
  acknowledge?: string[]
  /** The site record's own address, from the app's workspace (never from a request), so it can be checked against the repository. */
  siteDomain?: string
  /** Where this lands and anything unconfirmed about it, worked out by the caller's target check. Shown in the plan. */
  target?: PublishTarget
  warnings?: PlanWarning[]
  /** Only server code sets this (a schedule the owner already confirmed): it skips the review token. A request body can never carry it. */
  internal?: boolean
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
export async function planChanges(repo: Repo, changes: Change[], owned: ReadonlyMap<string, string>): Promise<Pick<PublishPlan, "head" | "files" | "unchanged" | "token">> {
  const [head, blobs] = await Promise.all([repo.head(), repo.blobs()])
  const files: PlanFile[] = []
  const identity: string[] = []
  let unchanged = 0
  for (const c of changes) {
    const there = blobs.get(c.path)
    if ("delete" in c) {
      if (there === undefined) continue
      files.push({ path: c.path, status: "removed", conflict: conflictOf(c.path, there, owned) })
      identity.push(`removed ${c.path}`)
      continue
    }
    const sha = gitBlobSha(c.content)
    if (there === sha) { unchanged++; continue }
    identity.push(`${there === undefined ? "added" : "changed"} ${c.path} ${sha}`)
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
  return { head, files, unchanged, token: planToken(head, identity) }
}

/** A fingerprint of "these exact changes on this exact commit", so a write can prove it is the plan the owner reviewed. */
export const planToken = (head: string, identity: readonly string[]) => createHash("sha256").update(`${head}\n${[...identity].sort().join("\n")}`).digest("hex").slice(0, 40)

function conflictOf(path: string, there: string, owned: ReadonlyMap<string, string>): PlanFile["conflict"] {
  if (!owned.has(path)) return "not-blackwalls"
  const wrote = owned.get(path)
  return wrote && wrote !== there ? "edited-elsewhere" : undefined
}

const BRANCH_OK = /^(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9][A-Za-z0-9._\/-]{0,98}[A-Za-z0-9]$/
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")

/** The wording suggested for a plan: the caller's commit message and title, a plain list of the files, a branch name. */
function suggestedText(text: { message: string; prTitle?: string }, files: readonly PlanFile[]): PlanText {
  const verb = { added: "Added", changed: "Changed", removed: "Removed" } as const
  return {
    message: text.message,
    prTitle: text.prTitle ?? text.message,
    prBody: files.length ? `${files.map((f) => `- ${verb[f.status]} \`${f.path}\``).join("\n")}\n` : "",
    branch: `update/${stamp()}`,
  }
}

/**
 * The one way files reach a repository. A plan comes first: it lists every change and names the target. A write must send back that plan's
 * token, so it is refused if the branch or any file differs from what the owner reviewed, and it carries the commit message (and for a pull
 * request the branch, title and description) the owner wrote. Files the owner made or changed elsewhere are never replaced without a yes.
 * Either commits to the branch or opens a pull request. Server code that acts on an earlier confirmation (a schedule) passes `internal`.
 */
export async function deliver(repo: Repo, text: { message: string; prTitle?: string }, changes: Change[], owned: ReadonlyMap<string, string>, opts: DeliverOptions = {}): Promise<Delivered> {
  const core = await planChanges(repo, changes, owned)
  const author = await repo.identity().catch(() => undefined)
  const plan: PublishPlan = { ...core, suggested: suggestedText(text, core.files), warnings: opts.warnings ?? [], ...(opts.target ? { target: opts.target } : {}), ...(author ? { author } : {}), ...(opts.stamp ? { stamp: opts.stamp } : {}) }
  if (opts.plan) return { plan }
  if (!opts.internal) {
    if (!opts.token) throw new ProviderError("Review the changes before they are written: this request didn't confirm a reviewed plan, so nothing was written.", 400)
    if (opts.expectedHead && opts.expectedHead !== plan.head) throw new ProviderError("The branch changed since you reviewed these changes (someone pushed). Nothing was written; review them again.", 409)
    if (opts.token !== plan.token) throw new ProviderError("The changes are no longer the ones you reviewed (a file or the branch changed). Nothing was written; review them again.", 409)
  }
  const need = plan.files.filter((f) => f.conflict && !(opts.acknowledge ?? []).includes(f.path))
  if (need.length) {
    const names = need.slice(0, 5).map((f) => `${f.path} (${f.conflict === "edited-elsewhere" ? "edited since Blackwall wrote it" : "not made by Blackwall"})`).join(", ")
    throw new ProviderError(`Publishing would replace ${need.length} file${need.length === 1 ? "" : "s"} that ${need.length === 1 ? "isn't" : "aren't"} Blackwall's to replace: ${names}${need.length > 5 ? ", …" : ""}. Nothing was written; review the changes and agree to replace them, or change them in the repository.`, 409)
  }
  if (!plan.files.length) return { plan }
  const message = (opts.message ?? "").trim() || (opts.internal ? plan.suggested.message : "")
  if (!message) throw new ProviderError("Write a commit message before publishing.", 400)
  if (message.length > 5000) throw new ProviderError("The commit message is too long.", 400)
  if (opts.mode === "pr") {
    const branch = (opts.branch ?? "").trim() || plan.suggested.branch
    if (!BRANCH_OK.test(branch) || branch.endsWith(".lock")) throw new ProviderError(`“${branch}” isn't a usable branch name. Use letters, numbers, dashes, dots and slashes.`, 400)
    if (branch === repo.branch) throw new ProviderError(`A pull request needs its own branch, not ${repo.branch}.`, 400)
    const title = (opts.prTitle ?? "").trim() || message.split("\n")[0]
    const done = await repo.commitTo(message, changes, { branch, expectedHead: plan.head, author })
    const made = await repo.createPullRequest(title, branch, opts.prBody ?? plan.suggested.prBody)
    return { plan, committed: { ...done, pr: made } }
  }
  return { plan, committed: await repo.commitTo(message, changes, { expectedHead: plan.head, author }) }
}
