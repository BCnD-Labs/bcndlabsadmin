import { useEffect, useState } from "react"
import { create } from "zustand"
import { FALLBACK_CHROME, type ScheduledPost, type SiteChrome, type SiteMediaItem, type SiteOverview, type SitePost } from "@shared/site"
import type { Draft } from "@/lib/types"
import type { PublishChoice, PublishPlan } from "@shared/publish-plan"
import { api, useConnectionFor, useConnections, useSession } from "./connector"
import { branchOf, reviewPublish } from "./publish-review"
import type { SourceStatus } from "./types"

/**
 * The website connection, as the CMS sees it: the posts and pages on the site,
 * scheduled posts, and the publish/schedule/remove actions. Everything goes
 * through Blackwall's server, which holds the GitHub token.
 */
interface SiteState {
  overview?: SiteOverview
  error?: string
  loading: boolean
  loadedFor?: string
  load: (connId: string, force?: boolean) => Promise<void>
  /** Shows what would change, then publishes. `cancelled` when the owner backed out; `pr` when it went to a pull request instead of live. */
  publish: (post: SitePost, previousSlug?: string) => Promise<PostPublish>
  schedule: (post: SitePost, publishAt: string) => Promise<ScheduledPost>
  unschedule: (slug: string) => Promise<void>
  unpublish: (slug: string) => Promise<PostPublish>
}

export interface PostPublish { url: string; cancelled?: boolean; pr?: { url: string; number: number }; unchanged?: boolean }
interface PostResult { url?: string; plan: PublishPlan; committed?: { sha: string; branch: string; pr?: { url: string; number: number } } }

/** Adds the website connection to a request, so each site talks to its own repository. */
export const forConnection = (path: string, connId?: string) => (connId ? `${path}${path.includes("?") ? "&" : "?"}connection=${encodeURIComponent(connId)}` : path)

export const useSiteStore = create<SiteState>()((set, get) => {
  const reload = () => {
    const id = get().loadedFor
    return id ? get().load(id, true) : Promise.resolve()
  }
  return {
    loading: false,
    load: async (connId, force) => {
      if (!force && get().loadedFor === connId && (get().overview || get().loading)) return
      set({ loading: true, loadedFor: connId })
      try {
        set({ overview: await api<SiteOverview>(forConnection("site/overview", connId)), error: undefined, loading: false })
      } catch (e) {
        set({ error: (e as Error).message, loading: false })
      }
    },
    publish: async (post, previousSlug) => {
      const conn = get().loadedFor
      const send = (body: object) => api<PostResult>(forConnection(`site/posts/${post.slug}`, conn), { method: "PUT", body: JSON.stringify({ post, previousSlug, ...body }) })
      const r = await reviewPublish({ title: `Publish “${post.title}”`, branch: branchOf(conn), plan: async () => (await send({ plan: true })).plan, run: (choice: PublishChoice) => send(choice) })
      if (!r) return { url: "", cancelled: true }
      if (previousSlug && previousSlug !== post.slug && !r.committed?.pr) await api(forConnection(`site/schedule/${previousSlug}`, conn), { method: "DELETE" }).catch(() => {})
      await reload()
      return { url: r.url ?? "", pr: r.committed?.pr, unchanged: !r.committed }
    },
    schedule: async (post, publishAt) => {
      const r = await api<ScheduledPost>(forConnection(`site/schedule/${post.slug}`, get().loadedFor), { method: "PUT", body: JSON.stringify({ post, publishAt }) })
      await reload()
      return r
    },
    unschedule: async (slug) => {
      await api(forConnection(`site/schedule/${slug}`, get().loadedFor), { method: "DELETE" })
      await reload()
    },
    unpublish: async (slug) => {
      const conn = get().loadedFor
      const send = (body: object) => api<PostResult>(forConnection(`site/posts/${slug}`, conn), { method: "DELETE", body: JSON.stringify(body) })
      const r = await reviewPublish({ title: "Take this post off the site", branch: branchOf(conn), plan: async () => (await send({ plan: true })).plan, run: (choice: PublishChoice) => send(choice) })
      if (!r) return { url: "", cancelled: true }
      await reload()
      return { url: "", pr: r.committed?.pr, unchanged: !r.committed }
    },
  }
})

export interface SiteFeed {
  status: SourceStatus
  overview?: SiteOverview
  error?: string
  refresh: () => void
}

/** Loads the site overview once the website connection is known. Pass a connection to use that site's own repository instead of the first one. */
export function useSite(connectionId?: string): SiteFeed {
  const first = useConnectionFor("website")
  const named = useConnections((s) => s.list.find((c) => c.id === connectionId && c.provider === "website"))
  const conn = connectionId ? named : first
  const session = useSession((s) => s.state)
  const { overview, error, loading, load, loadedFor } = useSiteStore()
  const usable = !!conn && conn.status === "ok"
  useEffect(() => {
    if (usable) void load(conn.id)
  }, [usable, conn?.id, load])
  const refresh = () => conn && void load(conn.id, true)
  if (session === "offline" || !conn) return { status: "not-connected", refresh }
  if (conn.status === "error") return { status: "error", error: conn.message, refresh }
  if (!usable) return { status: "not-connected", refresh }
  if (loadedFor !== conn.id || (loading && !overview)) return { status: "loading", refresh }
  if (error && !overview) return { status: "error", error, refresh }
  return { status: "live", overview, error, refresh }
}

const chromePromises = new Map<string, Promise<SiteChrome>>()
/** The site's header and stylesheets, for previews that look like the real thing. Each site's own repository when a connection is given. */
export function useSiteChrome(enabled: boolean, connectionId?: string): SiteChrome {
  const [chrome, setChrome] = useState<SiteChrome>(FALLBACK_CHROME)
  useEffect(() => {
    if (!enabled) return
    const key = connectionId ?? ""
    let promise = chromePromises.get(key)
    if (!promise) {
      promise = api<SiteChrome>(forConnection("site/chrome", connectionId)).catch((e) => {
        chromePromises.delete(key)
        throw e
      })
      chromePromises.set(key, promise)
    }
    let live = true
    promise.then((c) => live && setChrome(c)).catch(() => {})
    return () => {
      live = false
    }
  }, [enabled, connectionId])
  return chrome
}

/* --- images ------------------------------------------------------------------ */

/** Images uploaded in this session, shown from memory until the site redeploys with them. */
export const localImages = new Map<string, string>()

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "")
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })

/** Commits an image to the site's images folder; returns its site path. */
export async function uploadSiteImage(file: File): Promise<SiteMediaItem> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Images can be up to 8 MB")
  const item = await api<SiteMediaItem>("site/media", { method: "POST", body: JSON.stringify({ name: file.name, data: await fileToBase64(file) }) })
  localImages.set(item.path, URL.createObjectURL(file))
  return item
}

export const listSiteMedia = () => api<SiteMediaItem[]>("site/media")
export const deleteSiteMedia = (path: string) => api(`site/media?path=${encodeURIComponent(path)}`, { method: "DELETE" })

const rawCache = new Map<string, Promise<string>>()
/** Image bytes through the server (works before the site has redeployed, and for private repos). */
export function rawImageUrl(path: string): Promise<string> {
  let p = rawCache.get(path)
  if (!p) {
    p = fetch(`/api/site/raw?path=${encodeURIComponent(path)}`, { headers: { "X-Blackwall": "1" } }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return URL.createObjectURL(await r.blob())
    })
    p.catch(() => rawCache.delete(path))
    rawCache.set(path, p)
  }
  return p
}

/* --- drafts ↔ posts ---------------------------------------------------------- */

export type PostState = "published" | "scheduled" | "draft"

/** One row in the CMS: a local draft, a post on the site, or both. */
export interface PostItem {
  key: string
  slug: string
  title: string
  excerpt: string
  tags: string[]
  cover?: string
  state: PostState
  /** Published date, or the scheduled time. */
  date?: string
  updatedAt?: string
  draft?: Draft
  remote?: SitePost
  scheduled?: ScheduledPost
  /** The local draft has changes the site doesn't. */
  edited: boolean
}

export function draftToPost(d: Draft, date?: string): SitePost {
  return {
    slug: d.slug,
    title: d.title.trim(),
    excerpt: d.excerpt.trim(),
    tags: d.tags ?? [],
    cover: d.cover,
    coverAlt: d.coverAlt,
    date: date ?? new Date().toISOString(),
    markdown: d.body,
    ...(d.categories?.length ? { categories: d.categories } : {}),
    ...(d.featured ? { featured: true } : {}),
    ...(d.thumbnail ? { thumbnail: d.thumbnail, thumbnailAlt: d.thumbnailAlt } : {}),
  }
}

const same = (d: Draft, p: SitePost) =>
  d.slug === p.slug && d.title.trim() === p.title && d.excerpt.trim() === p.excerpt && d.body === p.markdown && (d.cover ?? "") === (p.cover ?? "") && JSON.stringify(d.tags ?? []) === JSON.stringify(p.tags) &&
  JSON.stringify(d.categories ?? []) === JSON.stringify(p.categories ?? []) && !!d.featured === !!p.featured && (d.thumbnail ?? "") === (p.thumbnail ?? "")

/** Merges local post drafts with what's on the site (published) and waiting (scheduled). */
export function mergePosts(drafts: Draft[], overview?: SiteOverview): PostItem[] {
  const posts = overview?.posts ?? []
  const scheduled = overview?.scheduled ?? []
  const used = new Set<string>()
  const items: PostItem[] = []
  for (const s of scheduled) {
    const d = drafts.find((x) => x.kind === "post" && x.remoteSlug === s.post.slug)
    if (d) used.add(d.id)
    items.push({
      key: `s:${s.post.slug}`,
      slug: s.post.slug,
      title: d?.title ?? s.post.title,
      excerpt: d?.excerpt ?? s.post.excerpt,
      tags: d?.tags ?? s.post.tags,
      cover: d ? d.cover : s.post.cover,
      state: "scheduled",
      date: s.publishAt,
      updatedAt: d?.updatedAt ?? s.createdAt,
      draft: d,
      scheduled: s,
      edited: !!d && !same(d, s.post),
    })
  }
  for (const p of posts) {
    if (scheduled.some((s) => s.post.slug === p.slug)) continue
    const d = drafts.find((x) => x.kind === "post" && x.remoteSlug === p.slug)
    if (d) used.add(d.id)
    items.push({
      key: `p:${p.slug}`,
      slug: p.slug,
      title: d?.title ?? p.title,
      excerpt: d?.excerpt ?? p.excerpt,
      tags: d?.tags ?? p.tags,
      cover: d ? d.cover : p.cover,
      state: "published",
      date: p.date,
      updatedAt: d?.updatedAt ?? p.updated ?? p.date,
      draft: d,
      remote: p,
      edited: !!d && !same(d, p),
    })
  }
  for (const d of drafts) {
    if (d.kind !== "post" || used.has(d.id)) continue
    items.push({ key: `d:${d.id}`, slug: d.slug, title: d.title, excerpt: d.excerpt, tags: d.tags ?? [], cover: d.cover, state: "draft", updatedAt: d.updatedAt, draft: d, edited: false })
  }
  const rank: Record<PostState, number> = { draft: 0, scheduled: 1, published: 2 }
  return items.sort((a, b) => rank[a.state] - rank[b.state] || (b.date ?? b.updatedAt ?? "").localeCompare(a.date ?? a.updatedAt ?? ""))
}

/* --- schedules (every post waiting to go out, on every site) ------------------------ */

interface SchedulesState {
  items: ScheduledPost[]
  loaded: boolean
  load: () => Promise<void>
}

/** Posts waiting to be published, with their next run and the last failure. Read again when a screen opens and after any change. */
export const useSchedules = create<SchedulesState>()((set) => ({
  items: [],
  loaded: false,
  load: async () => {
    try {
      set({ items: (await api<{ schedules: ScheduledPost[] }>("schedules")).schedules, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
}))

/** Schedules a Pagesmith post: when the time comes the server builds the site with the post in it and publishes through the same safe path as a click. */
export async function schedulePagesmithPost(siteId: string, draftId: string, publishAt: string, mode: "direct" | "pr" = "direct") {
  const r = await api<ScheduledPost>(`sites/${siteId}/schedule/${draftId}`, { method: "PUT", body: JSON.stringify({ publishAt, mode }) })
  await useSchedules.getState().load()
  return r
}

export async function unschedulePagesmithPost(siteId: string, draftId: string) {
  await api(`sites/${siteId}/schedule/${draftId}`, { method: "DELETE" })
  await useSchedules.getState().load()
}

/** The schedule a Pagesmith post is filed under. */
export const pagesmithScheduleKey = (siteId: string, draftId: string) => `${siteId}:${draftId}`
