import { useEffect, useState } from "react"
import { create } from "zustand"
import { FALLBACK_CHROME, type ScheduledPost, type SiteChrome, type SiteMediaItem, type SiteOverview, type SitePost } from "@shared/site"
import type { Draft } from "@/lib/types"
import { api, useConnectionFor, useConnections, useSession } from "./connector"
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
  publish: (post: SitePost, previousSlug?: string) => Promise<{ url: string }>
  schedule: (post: SitePost, publishAt: string) => Promise<ScheduledPost>
  unschedule: (slug: string) => Promise<void>
  unpublish: (slug: string) => Promise<void>
}

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
      const r = await api<{ url: string }>(forConnection(`site/posts/${post.slug}`, get().loadedFor), { method: "PUT", body: JSON.stringify({ post, previousSlug }) })
      if (previousSlug && previousSlug !== post.slug) await api(forConnection(`site/schedule/${previousSlug}`, get().loadedFor), { method: "DELETE" }).catch(() => {})
      await reload()
      return r
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
      await api(forConnection(`site/posts/${slug}`, get().loadedFor), { method: "DELETE" })
      await reload()
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
  }
}

const same = (d: Draft, p: SitePost) =>
  d.slug === p.slug && d.title.trim() === p.title && d.excerpt.trim() === p.excerpt && d.body === p.markdown && (d.cover ?? "") === (p.cover ?? "") && JSON.stringify(d.tags ?? []) === JSON.stringify(p.tags)

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
