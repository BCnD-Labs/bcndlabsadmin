/**
 * How the website side of Blackwall connects to the rest: tasks that point at pages and posts, a page started from a task,
 * a post shared to Social, and which analytics source speaks for which site. Linking only: nothing here ever completes a task.
 */
import { assetCloudPath, findAsset } from "./assets.ts"
import type { PublicConnection } from "./connections.ts"
import { daysBetween } from "./date-keys.ts"
import { hasLink } from "./links.ts"
import { PAGE_KINDS, nameFirstHeading, postHref, section, slugify } from "./sitebuilder.ts"
import type { Collections } from "./workspace.ts"
import type { Asset, Course, Draft, Site, SiteBlock, SitePage, SocialPost, Task } from "../src/lib/types.ts"

export type SiteLinkKind = "page" | "post"

/** The tasks that link to a page or post. The link lives on the task, so this is the other side of it. */
export const tasksLinkingTo = (data: Pick<Collections, "tasks">, kind: SiteLinkKind, id: string): Task[] => data.tasks.filter((t) => hasLink(t.recordLinks, kind, id))

/** Which week of the course a date falls in, when the course has a start date. */
export function courseWeek(course: Pick<Course, "startDate"> | undefined, date: string | undefined): number | undefined {
  if (!course?.startDate || !date) return undefined
  const days = daysBetween(date, course.startDate)
  return days < 0 ? undefined : Math.floor(days / 7) + 1
}

function fill(list: SiteBlock[], fn: (b: SiteBlock) => SiteBlock): SiteBlock[] {
  return list.map((b) => { const next = fn(b); return next.kids ? { ...next, kids: fill(next.kids, fn) } : next })
}

/** An address not used by another page of the site. */
export function freeSlug(base: string, pages: readonly Pick<SitePage, "slug">[]) {
  const stem = slugify(base) || "page"
  const taken = new Set(pages.map((p) => p.slug))
  let slug = stem, n = 2
  while (taken.has(slug)) slug = `${stem}-${n++}`
  return slug
}

/** A page started from a task: its title, and for coursework the course and week filled in. It stays out of the menu until you add it. */
export function pageFromTask(task: Pick<Task, "title" | "due">, course: Course | undefined, kindKey: string, sitePages: readonly SitePage[]): Omit<SitePage, "id" | "siteId" | "createdAt" | "updatedAt"> {
  const kind = PAGE_KINDS[kindKey] ?? PAGE_KINDS.blank
  const week = courseWeek(course, task.due)
  const line = [course?.code, week != null && `Week ${week}`, task.due && `Due ${task.due}`].filter(Boolean).join(" · ")
  let filled = false
  const sections = fill(nameFirstHeading(kind.sections.map(section), task.title), (b) => {
    if (b.type === "text" && !filled && line) { filled = true; return { ...b, text: line } }
    if (b.type === "postsByWeek" && course?.code) return { ...b, course: course.code }
    return b
  })
  return { title: task.title, slug: freeSlug(task.title, sitePages), description: "", inMenu: false, order: Math.max(-1, ...sitePages.map((p) => p.order)) + 1, sections }
}

/** The address of a post on its site: a full one when the site has a domain. */
export function postAddress(post: Pick<Draft, "slug">, site: Pick<Site, "domain"> | undefined) {
  const domain = site?.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  return domain ? `https://${domain}${postHref(post)}` : undefined
}

/** A Social draft for a post: its title, summary, cover picture and address, for the accounts you picked. */
export function socialDraftFromPost(post: Draft, site: Site | undefined, assets: readonly Asset[], accountIds: string[]): Omit<SocialPost, "id" | "createdAt" | "updatedAt"> {
  const cover = findAsset(assets, post.cover)
  return {
    title: post.title,
    body: post.excerpt,
    link: postAddress(post, site),
    media: cover ? assetCloudPath(cover) : post.cover,
    stage: "draft",
    accountIds,
    posted: [],
  }
}

const bareHost = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")

/**
 * The analytics source that speaks for a site: the one picked in its Settings, or a source reporting on the site's own domain.
 * Undefined means none is mapped, and nothing should be shown as if it were this site's numbers.
 */
export function siteAnalyticsConnection<C extends Pick<PublicConnection, "id" | "provider" | "config">>(site: Pick<Site, "domain" | "analyticsConnectionId">, connections: readonly C[]): C | undefined {
  const sources = connections.filter((c) => c.provider === "analytics")
  if (site.analyticsConnectionId) return sources.find((c) => c.id === site.analyticsConnectionId)
  const domain = bareHost(site.domain)
  return domain ? sources.find((c) => c.config.siteId && bareHost(c.config.siteId) === domain) : undefined
}
