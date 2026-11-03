/**
 * Linked documents (`links`: a label and a URL that open in whatever app owns the file). Same rules
 * as the web's components/common/doc-links.tsx: web links and the listed app schemes are allowed,
 * script/data URLs never. Native only stores and shows them; it never opens an external app.
 */
import type { Collections } from "../../../lib/shared.ts"

export type DocLink = NonNullable<Collections["tasks"][number]["links"]>[number]
export const MAX_DOC_LINKS = 50
const SAFE = /^(https?:\/\/|siyuan:|obsidian:|vscode:|onenote:|ms-(word|excel|powerpoint):|notion:|affine:|mailto:)/i

export const isSafeLink = (url: string): boolean => SAFE.test(url.trim())

function hostOf(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname || u.protocol.replace(":", "")
  } catch {
    return url.slice(0, 40)
  }
}

/** Trimmed links without blank-URL rows; an empty label becomes the host. Unsafe URLs are reported by `linkProblem`, not dropped here. */
export const cleanLinks = (links: readonly DocLink[]): DocLink[] =>
  links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.url).map((l) => ({ ...l, label: l.label || hostOf(l.url) }))

/** Why these links can't be saved (the web quietly dropped unsafe ones; native says so instead of losing them). */
export function linkProblem(links: readonly DocLink[]): string | undefined {
  if (links.length > MAX_DOC_LINKS) return `Up to ${MAX_DOC_LINKS} links.`
  if (links.some((l) => l.url.trim() && !isSafeLink(l.url))) return "Use a web link (https://) or an app link like siyuan://."
  return undefined
}
