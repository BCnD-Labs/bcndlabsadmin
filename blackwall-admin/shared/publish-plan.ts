/** What a publish would do to a repository, shared by the server (which works it out) and the review screen (which shows it). */

/** One file a publish would write or remove, with the text before and after when it's small enough to show. */
export interface PlanFile {
  path: string
  status: "added" | "changed" | "removed"
  /** The file exists but Blackwall didn't make it, or it was edited somewhere else since Blackwall last wrote it. Publishing needs a yes for each. */
  conflict?: "not-blackwalls" | "edited-elsewhere"
  before?: string
  after?: string
  /** Not shown as text (a picture, or too large). */
  hidden?: boolean
}

/** Where a publish would land. Shown at the top of every review so the destination can't be mistaken. */
export interface PublishTarget {
  repo: string
  branch: string
  /** The site's public address as the owner entered it, or "" when none is set. */
  siteUrl: string
}

/** Something the owner should know before confirming. It never blocks by itself. */
export interface PlanWarning {
  code: string
  message: string
  /** The publish can't go ahead until one of the `fixes` is chosen (the review re-plans with it, so the change is shown first). */
  blocking?: boolean
  fixes?: { option: "addRegion" | "unlisted" | "migrateMarkers"; label: string }[]
}

/** The wording Blackwall suggests for the commit and, in pull request mode, for the branch and pull request. The owner edits all of it. */
export interface PlanText {
  message: string
  prTitle: string
  prBody: string
  branch: string
}

export interface PublishPlan {
  /** The branch's commit when the plan was made. Sent back with the publish, it makes the publish refuse if someone pushed meanwhile. */
  head: string
  files: PlanFile[]
  unchanged: number
  /** Identifies exactly these changes on exactly this commit. A write must send it back, and is refused if the files or the branch differ now. */
  token: string
  target?: PublishTarget
  /** Who the commit will be made as, when GitHub told us. */
  author?: { name: string; email: string }
  suggested: PlanText
  warnings: PlanWarning[]
  /** The time the changes were built with (a post's updated time). Sent back with the write so the files are byte-identical to the reviewed ones. */
  stamp?: string
}

/** What the owner chose on the review screen. */
export interface PublishChoice {
  mode: "direct" | "pr"
  expectedHead: string
  /** The plan being confirmed. */
  token: string
  /** Files the owner agreed to replace. */
  acknowledge: string[]
  /** The commit message, and for a pull request its branch, title and description, as the owner wrote them. */
  message: string
  prTitle?: string
  prBody?: string
  branch?: string
  stamp?: string
  /** Fixes the owner picked for warnings that needed one. */
  addRegion?: boolean
  unlisted?: boolean
  migrateMarkers?: boolean
}

/** The fixes chosen so far in a review; the plan is made again with them so the change they cause is shown before anything is written. */
export type PlanOptions = Partial<Pick<PublishChoice, "addRegion" | "unlisted" | "migrateMarkers">>

export type DiffRow = { kind: "same" | "add" | "del"; text: string } | { kind: "gap"; hidden: number }

const LIMIT = 700

/** A line-by-line difference, with a few lines of context around each change and the rest folded into gaps. */
export function lineDiff(before: string, after: string, context = 3): DiffRow[] {
  const a = before.split("\n"), b = after.split("\n")
  let rows: { kind: "same" | "add" | "del"; text: string }[]
  if (a.length > LIMIT || b.length > LIMIT) {
    rows = [...a.map((text) => ({ kind: "del" as const, text })), ...b.map((text) => ({ kind: "add" as const, text }))]
  } else {
    const n = a.length, m = b.length
    const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    rows = []
    let i = 0, j = 0
    while (i < n && j < m) {
      if (a[i] === b[j]) { rows.push({ kind: "same", text: a[i] }); i++; j++ }
      else if (lcs[i + 1][j] >= lcs[i][j + 1]) rows.push({ kind: "del", text: a[i++] })
      else rows.push({ kind: "add", text: b[j++] })
    }
    while (i < n) rows.push({ kind: "del", text: a[i++] })
    while (j < m) rows.push({ kind: "add", text: b[j++] })
  }
  const keep = rows.map((r) => r.kind !== "same")
  const near = rows.map((_, i) => keep.slice(Math.max(0, i - context), i + context + 1).some(Boolean))
  const out: DiffRow[] = []
  let hidden = 0
  rows.forEach((r, i) => {
    if (near[i]) { if (hidden) out.push({ kind: "gap", hidden }); hidden = 0; out.push(r) } else hidden++
  })
  if (hidden) out.push({ kind: "gap", hidden })
  return out
}
