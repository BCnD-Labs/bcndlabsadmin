/**
 * The accessibility check: what WAVE would flag on the pages Pagesmith builds, found from the site's own blocks and
 * colours (so each finding points at the block that causes it, before anything is published). It reports in WAVE's
 * five kinds: errors, contrast errors, alerts, features that are in place, and the page's structure.
 *
 * It can't see inside Custom HTML blocks or your own CSS, and it doesn't replace running WAVE and Lighthouse on the live
 * site; `unchecked` says what was left out so a clean report is never read as more than it is.
 */
import type { Asset, Draft, Site, SiteBlock, SitePage } from "../src/lib/types.ts"
import { contrast, onAccent, pairLines } from "./sitebuilder.ts"
import { findAsset } from "./assets.ts"

export type A11yKind = "error" | "contrast" | "alert" | "feature" | "structure"
export const A11Y_KINDS: A11yKind[] = ["error", "contrast", "alert", "feature", "structure"]

export interface A11yItem {
  kind: A11yKind
  rule: string
  text: string
  pageId?: string
  blockId?: string
  postId?: string
  /** Where the fix lives when it isn't a block. */
  area?: "look" | "settings"
}

export interface A11yReport {
  items: A11yItem[]
  counts: Record<A11yKind, number>
  /** What this check can't look at, in plain words. */
  unchecked: string[]
}

const has = (v: unknown) => typeof v === "string" && v.trim().length > 0
const VAGUE = /^(click here|here|read more|more|link|this|this link|learn more|click|go)$/i
const NOT_A_DESCRIPTION = /^(image|picture|photo|graphic|img)\b|\.(jpe?g|png|webp|gif|svg)$|^dsc_?\d|^img_?\d/i

function walk(list: SiteBlock[], fn: (b: SiteBlock) => void) {
  for (const b of list) {
    fn(b)
    if (b.kids) walk(b.kids, fn)
  }
}

/** The text/background pairs a visitor reads, in one colour set. */
function pairs(pal: Site["light"]) {
  return [
    { what: "text on the page", fg: pal.text, bg: pal.bg, min: 4.5 },
    { what: "quieter text on the page", fg: pal.muted, bg: pal.bg, min: 4.5 },
    { what: "links on the page", fg: pal.accent, bg: pal.bg, min: 4.5 },
    { what: "text on shaded areas and cards", fg: pal.text, bg: pal.surface, min: 4.5 },
    { what: "quieter text on shaded areas and cards", fg: pal.muted, bg: pal.surface, min: 4.5 },
    { what: "links on shaded areas and cards", fg: pal.accent, bg: pal.surface, min: 4.5 },
    { what: "button text", fg: onAccent(pal.accent), bg: pal.accent, min: 4.5 },
  ]
}

export function auditSite(site: Site, pages: SitePage[], assets: Asset[] = [], posts: Draft[] = []): A11yReport {
  const items: A11yItem[] = []
  const add = (i: A11yItem) => items.push(i)
  const own = pages.filter((p) => p.siteId === site.id).sort((a, b) => a.order - b.order)

  // Colours, in each mode a visitor can see.
  const modes = [["light", site.light], ...(site.darkMode ? [["dark", site.dark] as const] : [])] as const
  let failed = 0
  for (const [mode, pal] of modes) {
    for (const p of pairs(pal)) {
      const ratio = contrast(p.fg, p.bg)
      if (ratio >= p.min) continue
      failed++
      add({ kind: "contrast", rule: "contrast", area: "look", text: `${mode === "dark" ? "Dark mode: " : ""}${p.what} is too faint (${ratio.toFixed(1)} to 1; it needs ${p.min} to 1). Change the colours in Look.` })
    }
  }
  if (!failed) add({ kind: "feature", rule: "contrast", area: "look", text: `Text, link and button colours are readable${site.darkMode ? " in light and dark mode" : ""} (at least 4.5 to 1).` })

  // What every page Pagesmith builds already has.
  add({ kind: "feature", rule: "landmarks", text: "Every page has a header, a navigation menu, a main area and a footer, and the language is set." })
  add({ kind: "feature", rule: "skip-link", text: "Every page starts with a “Skip to main content” link for keyboard users." })
  if (site.framework === "bootstrap" || own.some((p) => p.parentId)) add({ kind: "feature", rule: "menu", text: "The menu works with the keyboard." })
  if (site.themeToggle && site.darkMode) add({ kind: "feature", rule: "theme-toggle", text: "The light/dark button says what it does and whether it is on." })
  if (site.themeToggle && !site.darkMode) add({ kind: "alert", rule: "theme-toggle", area: "look", text: "The light/dark button is on but the dark colours are off, so it won't show. Turn on dark mode in Look." })

  const titles = new Map<string, string[]>()
  for (const page of own) {
    const name = page.title || "Untitled page"
    const at = { pageId: page.id }
    if (!has(page.title)) add({ kind: "error", rule: "page-title", text: `${name} has no title, so the browser tab and screen readers have nothing to say.`, ...at })
    else titles.set(page.title.trim().toLowerCase(), [...(titles.get(page.title.trim().toLowerCase()) ?? []), page.id])

    let h1Used = false, prev = 0, described = 0
    const linkTargets = new Map<string, Set<string>>(), firstLinkBlock = new Map<string, string>()
    walk(page.sections, (b) => {
      const id = { ...at, blockId: b.id }
      if (b.type === "heading") {
        const lv = b.level === "1" ? (h1Used ? 2 : 1) : [1, 2, 3].includes(Number(b.level || 2)) ? Number(b.level || 2) : 2
        if (lv === 1) h1Used = true
        if (!has(b.text)) add({ kind: "error", rule: "empty-heading", text: `${name}: a heading is empty.`, ...id })
        else add({ kind: "structure", rule: "heading", text: `h${lv}  ${String(b.text).trim()}`, ...id })
        if (!prev && lv !== 1) add({ kind: "alert", rule: "heading-start", text: `${name}: the first heading is an h${lv}, so the page doesn't start with a page title.`, ...id })
        else if (prev && lv > prev + 1) add({ kind: "alert", rule: "heading-skip", text: `${name}: heading level skipped (h${prev} to h${lv}). Screen reader users move by heading level.`, ...id })
        prev = lv
      } else if (b.type === "image") {
        if (!has(b.src)) return
        const alt = String(b.alt ?? "").trim()
        if (!alt) add({ kind: "error", rule: "alt-missing", text: `${name}: a picture has no description for people who can't see it.`, ...id })
        else {
          described++
          if (NOT_A_DESCRIPTION.test(alt)) add({ kind: "alert", rule: "alt-suspicious", text: `${name}: the description “${alt}” looks like a file name or starts with “image of”. Say what the picture shows.`, ...id })
          else if (alt.length > 125) add({ kind: "alert", rule: "alt-long", text: `${name}: a picture's description is ${alt.length} letters long. Keep it under about 125.`, ...id })
        }
        if (!findAsset(assets, String(b.src).trim())) add({ kind: "alert", rule: "asset", text: `${name}: a picture isn't from the asset library, so its size isn't known and the page may jump as it loads.`, ...id })
      } else if (b.type === "button" || b.type === "link") {
        const label = String(b.text ?? "").trim()
        if (!label) add({ kind: "error", rule: "empty-link", text: `${name}: a ${b.type} has no text, so a screen reader can only say “link”.`, ...id })
        else if (VAGUE.test(label)) add({ kind: "alert", rule: "vague-link", text: `${name}: the ${b.type} “${label}” doesn't say where it goes.`, ...id })
        const href = String(b.href ?? "").trim()
        if (label && href) {
          const key = label.toLowerCase()
          linkTargets.set(key, new Set([...(linkTargets.get(key) ?? []), href]))
          if (!firstLinkBlock.has(key)) firstLinkBlock.set(key, b.id)
        }
      } else if (b.type === "video") {
        const url = String(b.url ?? "").trim()
        if (!url) return
        if (!has(b.title)) add({ kind: "error", rule: "media-title", text: `${name}: a video or audio player has no title, so a screen reader can't say what it is.`, ...id })
        else add({ kind: "feature", rule: "media-title", text: `${name}: “${String(b.title).trim()}” has a title for screen readers.`, ...id })
        add({ kind: "alert", rule: "captions", text: /\.(mp3|ogg|wav|m4a)(\?.*)?$/i.test(url) ? `${name}: audio needs the words written out nearby, for people who can't hear it.` : `${name}: make sure the video has captions turned on in YouTube. This check can't see them.`, ...id })
      } else if (b.type === "dropdown") {
        if (!has(b.label)) add({ kind: "error", rule: "empty-link", text: `${name}: a dropdown button has no label, so a screen reader can only say “button”.`, ...id })
        if (!pairLines(b.items).length) add({ kind: "alert", rule: "empty-menu", text: `${name}: a dropdown has no options.`, ...id })
      } else if (b.type === "tooltip") {
        if (!has(b.tip)) add({ kind: "alert", rule: "empty-tooltip", text: `${name}: a tooltip has no text to show.`, ...id })
      } else if (b.type === "calendar") {
        add({ kind: "feature", rule: "table-header", text: `${name}: the calendar has a caption and day-of-week headings.`, ...id })
      } else if (b.type === "table") {
        add({ kind: "feature", rule: "table-header", text: `${name}: a table's first row is marked as its header.`, ...id })
      } else if (b.type === "form" && has(b.formId)) {
        add({ kind: "feature", rule: "form-labels", text: `${name}: every form field has a label.`, ...id })
      } else if (b.type === "html" && has(b.code)) {
        add({ kind: "alert", rule: "custom-html", text: `${name}: Custom HTML isn't checked here. Run WAVE on the live page to be sure it is accessible.`, ...id })
      }
    })
    if (!h1Used && page.sections.length) add({ kind: "alert", rule: "no-h1", text: `${name} has no page title (a big heading). Make the first heading “Page title” size.`, ...at })
    if (described) add({ kind: "feature", rule: "alt", text: `${name}: ${described} ${described === 1 ? "picture has" : "pictures have"} a description.`, ...at })
    for (const [label, targets] of linkTargets) if (targets.size > 1) add({ kind: "alert", rule: "same-link-text", text: `${name}: two links say “${label}” but go to different places.`, pageId: page.id, blockId: firstLinkBlock.get(label) })
  }
  for (const ids of titles.values()) if (ids.length > 1) add({ kind: "alert", rule: "duplicate-title", text: `${ids.length} pages share the title “${own.find((p) => p.id === ids[0])?.title}”. Distinct titles help people tell tabs and history apart.`, pageId: ids[1] })

  // Posts: the Markdown can leave a picture undescribed, and a cover has its own description.
  for (const post of posts.filter((p) => p.siteId === site.id)) {
    const name = post.title || post.slug
    const bare = (post.body.match(/!\[\s*\]\(/g) ?? []).length
    if (bare) add({ kind: "error", rule: "alt-missing", postId: post.id, text: `The post “${name}” has ${bare === 1 ? "a picture" : `${bare} pictures`} with no description (the text in the square brackets).` })
    if (post.cover && !has(post.coverAlt)) add({ kind: "error", rule: "alt-missing", postId: post.id, text: `The post “${name}” has a cover picture with no description.` })
    if (/^# /m.test(post.body)) add({ kind: "alert", rule: "heading-skip", postId: post.id, text: `The post “${name}” has its own big heading, and the page already has the post title as its h1.` })
  }

  const counts = Object.fromEntries(A11Y_KINDS.map((k) => [k, items.filter((i) => i.kind === k).length])) as Record<A11yKind, number>
  const unchecked = [
    "Custom HTML blocks and your own CSS.",
    "Captions inside videos, and whether pictures are described well (only that they are).",
    "Keyboard use and screen-reader wording on the live page. Run WAVE (wave.webaim.org) and Lighthouse on the published site for the final word.",
  ]
  return { items, counts, unchecked }
}
