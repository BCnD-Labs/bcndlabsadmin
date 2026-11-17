import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { format } from "date-fns"
import { CalendarClock, Copy, ExternalLink, FileText, Globe, MoreHorizontal, Pencil, Plus, RotateCw, Search, Trash2, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { MARK_END, MARK_START, draftFieldsFromPost, joinUrl } from "@shared/site"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { SourceBadge } from "@/components/common/source-badge"
import { StatStrip } from "@/components/common/stat-strip"
import { StatusMarker } from "@/components/common/tags"
import { timeAgo, timeFmt } from "@/lib/dates"
import { draftHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAnalytics } from "@/services/data"
import { mergePosts, useSite, useSiteStore, type PostItem, type PostPublish, type PostState } from "@/services/site"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { CoverPlaceholder, LiveThumb, SiteImage } from "./site-image"
import { useCreateDraft } from "./use-create-draft"

type View = "posts" | "pages"
type Show = "all" | PostState

const SHOW_LABEL: Record<Show, string> = { all: "All", published: "Published", scheduled: "Scheduled", draft: "Drafts" }

/** CMS → Posts & pages: everything on the site and in progress, as cards with their cover or a live preview. */
export function ContentPage({ adopted }: { adopted?: Site } = {}) {
  const site = useSite(adopted?.connectionId)
  const allDrafts = useWorkspace((s) => s.drafts)
  const drafts = useMemo(() => (adopted ? allDrafts.filter((d) => d.siteId === adopted.id) : allDrafts), [allDrafts, adopted])
  const createDraft = useCreateDraft()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view: View = params.get("view") === "pages" ? "pages" : "posts"
  const showParam = params.get("show")
  const show: Show = showParam === "drafts" ? "draft" : showParam === "published" || showParam === "scheduled" ? showParam : "all"
  const [q, setQ] = useState("")
  const traffic = useAnalytics(30)

  const items = useMemo(() => mergePosts(drafts, site.overview), [drafts, site.overview])
  const count = (s: Show) => (s === "all" ? items.length : items.filter((i) => i.state === s).length)
  const needle = q.trim().toLowerCase()
  const shown = items.filter((i) => (show === "all" || i.state === show) && (!needle || i.title.toLowerCase().includes(needle) || i.tags.some((t) => t.toLowerCase().includes(needle))))
  const pageDrafts = drafts.filter((d) => d.kind === "page")
  const pages = site.overview?.pages ?? []

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const newPost = () => navigate(draftHref(createDraft(adopted ? { siteId: adopted.id } : undefined).id))
  const visitors = traffic.data?.traffic.reduce((a, p) => a + p.visitors, 0)
  const host = site.overview?.siteUrl.replace(/^https?:\/\//, "")

  return (
    <>
      <PageHeader
        title="Posts & pages"
        badge={<SourceBadge status={site.status} detail={site.status === "live" ? host : undefined} hint={site.status === "live" ? `Publishes to ${site.overview?.repo} (${site.overview?.branch})` : undefined} />}
        actions={
          <>
            {site.overview?.siteUrl && (
              <Button variant="ghost" asChild>
                <a href={site.overview.siteUrl} target="_blank" rel="noreferrer">
                  <Globe /> View site
                </a>
              </Button>
            )}
            <Button onClick={newPost}>
              <Plus /> New post
            </Button>
          </>
        }
      />
      <WorkspaceGrid>
        <GridItem span="full">
        <StatStrip
          items={[
            { label: "Published", value: site.overview ? count("published") : <span className="text-faint">—</span> },
            { label: "Scheduled", value: site.overview ? count("scheduled") : <span className="text-faint">—</span>, sub: nextScheduled(items) },
            { label: "Drafts", value: count("draft") },
            {
              label: "Visitors, 30 days",
              value: visitors ?? <span className="text-faint">—</span>,
              sub: traffic.status === "sample" ? "sample data" : traffic.status === "live" ? traffic.provider : "analytics not connected",
            },
          ]}
        />
        </GridItem>
        <GridItem span="full"><SiteNotice site={site} /></GridItem>
        <GridItem span="full">

        <section className="flex min-w-0 flex-col" aria-label="Posts & pages">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTabs
              label="Posts or pages"
              value={view}
              onChange={(v) => set({ view: v === "posts" ? null : v })}
              className="w-full sm:w-56"
              tabs={[
                { value: "posts", label: "Posts", count: items.length },
                { value: "pages", label: "Pages", count: pages.length + pageDrafts.length },
              ]}
            />
            {view === "posts" && (
              <>
                <SegmentedTabs
                  label="Filter posts"
                  value={show}
                  onChange={(s) => set({ show: s === "all" ? null : s === "draft" ? "drafts" : s })}
                  className="max-w-full overflow-x-auto [scrollbar-width:none]"
                  tabClassName="flex-none px-2.5"
                  tabs={(["all", "published", "scheduled", "draft"] as Show[]).map((s) => ({ value: s, label: SHOW_LABEL[s], count: count(s) }))}
                />
                <label className="relative ml-auto w-full sm:w-48">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search posts"
                    aria-label="Search posts"
                    className="h-8 w-full rounded-[var(--bw-control-radius)] border border-rim bg-well pr-2 pl-8 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-faint focus:border-ink-2/40 md:text-[13px]"
                  />
                </label>
              </>
            )}
            {site.status === "live" && (
              <Button variant="quiet" size="icon-sm" aria-label="Reload from the site" title="Reload from the site" className={cn(view === "pages" && "ml-auto")} onClick={site.refresh}>
                <RotateCw />
              </Button>
            )}
          </div>

          {view === "posts" ? (
            shown.length ? (
              <ul className="bw-card-grid pt-3" aria-label="Posts">
                {shown.map((i) => (
                  <PostCard key={i.key} item={i} siteUrl={site.overview?.siteUrl} postsBase={site.overview} />
                ))}
              </ul>
            ) : (
              <EmptyState roomy={!items.length} icon={FileText} title={items.length ? "No posts match" : "No posts yet"} action={!items.length && <Button variant="outline" onClick={newPost}><Plus /> New post</Button>}>
                {items.length ? "Try another filter." : "Write a post, add a cover image, then publish it or schedule it for later."}
              </EmptyState>
            )
          ) : (
            <PagesGrid pages={pages} drafts={pageDrafts} status={site.status} />
          )}
        </section></GridItem>
      </WorkspaceGrid>
    </>
  )
}

function nextScheduled(items: PostItem[]) {
  const next = items.filter((i) => i.state === "scheduled" && i.date).sort((a, b) => a.date!.localeCompare(b.date!))[0]
  return next ? `next ${format(new Date(next.date!), `EEE MMM d, ${timeFmt()}`)}` : undefined
}

/** Setup hints: blog index without the markers, or a scheduled post that failed. */
function SiteNotice({ site }: { site: ReturnType<typeof useSite> }) {
  const failed = site.overview?.scheduled.filter((s) => s.error) ?? []
  if (site.status === "error")
    return (
      <Notice tone="error">
        Couldn't reach your site's repository: <span className="font-mono">{site.error}</span>{" "}
        <button type="button" className="underline" onClick={() => useUi.getState().openSettings("connections")}>Connection settings</button>
      </Notice>
    )
  if (site.status !== "live" || !site.overview) return null
  return (
    <>
      {failed.map((s) => (
        <Notice key={s.post.slug} tone="error">
          “{s.post.title}” was due {format(new Date(s.publishAt), `MMM d, ${timeFmt()}`)} but didn't publish: {s.error}. Blackwall retries every 10 minutes.
        </Notice>
      ))}
      {!site.overview.indexMarkers && (
        <Notice tone="warn">
          Published posts get their own pages, but your blog page won't list them until you add these two lines where the cards should go:{" "}
          <code className="rounded bg-well px-1 font-mono text-[11px]">{MARK_START}</code> <code className="rounded bg-well px-1 font-mono text-[11px]">{MARK_END}</code>
          <button
            type="button"
            className="ml-2 inline-flex items-center gap-1 underline"
            onClick={() => navigator.clipboard.writeText(`${MARK_START}\n${MARK_END}`).then(() => toast.success("Copied"))}
          >
            <Copy className="size-3" /> Copy
          </button>
        </Notice>
      )}
    </>
  )
}

function Notice({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  return (
    <p role="status" className="bw-panel flex items-start gap-2.5 px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
      <StatusMarker tone={tone} className="mt-1.5" />
      <span>{children}</span>
    </p>
  )
}

export function PostStateChip({ state, edited, date }: { state: PostState; edited?: boolean; date?: string }) {
  const tone = state === "published" ? "ok" : state === "scheduled" ? "warn" : "off"
  const label = state === "published" ? "Published" : state === "scheduled" ? "Scheduled" : "Draft"
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase" title={date ? format(new Date(date), "PPPp") : undefined}>
      <StatusMarker tone={tone} />
      {label}
      {edited && <span className="font-medium normal-case tracking-normal text-amber">· edited</span>}
    </span>
  )
}

function PostCard({ item, siteUrl, postsBase }: { item: PostItem; siteUrl?: string; postsBase?: { postsUrl: string } }) {
  const navigate = useNavigate()
  const create = useWorkspace((s) => s.create)
  const remove = useWorkspace((s) => s.remove)
  const { unpublish, unschedule } = useSiteStore()
  const [busy, setBusy] = useState(false)
  const liveUrl = item.state === "published" && postsBase?.postsUrl ? postUrl(postsBase.postsUrl, item.slug) : undefined

  /** Open the editor; a post that only exists on the site gets a local draft first. */
  const edit = () => {
    if (item.draft) return navigate(draftHref(item.draft.id))
    const src = item.remote ?? item.scheduled?.post
    if (!src) return
    const d = create("drafts", { ...draftFieldsFromPost(src), kind: "post", status: "ready" })
    navigate(draftHref(d.id))
  }
  const run = async (fn: () => Promise<void | PostPublish>, done: string) => {
    setBusy(true)
    try {
      const r = await fn()
      if (r && r.cancelled) return
      if (r && r.pr) toast.success(`Opened pull request #${r.pr.number}`, { description: "Nothing changes on the site until you merge it.", action: { label: "View", onClick: () => window.open(r.pr!.url, "_blank", "noreferrer") } })
      else toast.success(done)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={cn("bw-panel group relative flex flex-col overflow-hidden transition-colors hover:bg-raised", busy && "opacity-60")} data-testid="post-card">
      <button type="button" onClick={edit} className="flex flex-1 flex-col text-left" aria-label={`Edit ${item.title}`}>
        {item.cover ? (
          <SiteImage path={item.cover} siteUrl={siteUrl} className="aspect-[2/1] w-full" />
        ) : (
          <CoverPlaceholder title={item.title} className="h-20 w-full" />
        )}
        <span className="flex flex-1 flex-col gap-1 px-3.5 pt-3 pb-3.5">
          <span className="line-clamp-2 text-[13px] leading-snug font-semibold text-ink">{item.title || "Untitled"}</span>
          {item.excerpt && <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground max-sm:hidden">{item.excerpt}</span>}
          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
            <PostStateChip state={item.state} edited={item.edited} date={item.date} />
            <span className="text-[11px] text-faint">
              {item.state === "scheduled" && item.date
                ? format(new Date(item.date), `MMM d, ${timeFmt()}`)
                : item.state === "published" && item.date
                  ? format(new Date(item.date), "MMM d, yyyy")
                  : item.updatedAt
                    ? `edited ${timeAgo(item.updatedAt)}`
                    : ""}
            </span>
          </span>
          {item.tags.length > 0 && (
            <span className="flex flex-wrap gap-1 pt-1">
              {item.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-ink-2/8 px-2 text-[10px] leading-4 text-muted-foreground">{t}</span>
              ))}
            </span>
          )}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${item.title}`} className="absolute top-2 right-2 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={edit}><Pencil /> Edit</DropdownMenuItem>
          {liveUrl && (
            <DropdownMenuItem asChild>
              <a href={liveUrl} target="_blank" rel="noreferrer"><ExternalLink /> View on site</a>
            </DropdownMenuItem>
          )}
          {item.state === "scheduled" && (
            <DropdownMenuItem onSelect={() => run(() => unschedule(item.slug), "Unscheduled; it's a draft again")}>
              <CalendarClock /> Unschedule
            </DropdownMenuItem>
          )}
          {item.state === "published" && (
            <DropdownMenuItem onSelect={() => run(() => unpublish(item.slug), "Removed from the site")}>
              <Undo2 /> Unpublish
            </DropdownMenuItem>
          )}
          {item.draft && item.state === "draft" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  const d = item.draft!
                  remove("drafts", d.id)
                  toast("Draft deleted", { action: { label: "Undo", onClick: () => useWorkspace.setState((s) => ({ drafts: [d, ...s.drafts] })) } })
                }}
                className="text-red-text"
              >
                <Trash2 /> Delete draft
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

/** A published post's address on the site. */
export const postUrl = (postsUrl: string, slug: string) => joinUrl(postsUrl, `${slug}.html`)

function PagesGrid({ pages, drafts, status }: { pages: { path: string; title: string; url: string }[]; drafts: { id: string; title: string; slug: string; updatedAt: string }[]; status: string }) {
  if (!pages.length && !drafts.length)
    return (
      <EmptyState roomy={status !== "live"} icon={Globe} title={status === "live" ? "No pages found" : "Pages come from your site"} action={status !== "live" && <Button variant="outline" onClick={() => useUi.getState().openSettings("connections", "website")}>Connect your website</Button>}>
        {status === "live" ? "Blackwall looks for .html pages in the top folders of the repository." : "Once your website is connected, its pages show here with a live preview."}
      </EmptyState>
    )
  return (
    <>
      <ul className="bw-card-grid pt-3" aria-label="Pages">
        {pages.map((p) => (
          <li key={p.path} className="bw-panel group flex flex-col overflow-hidden hover:bg-raised" data-testid="page-card">
            {p.url ? <LiveThumb url={p.url} title={p.title} className="aspect-[2/1] w-full" /> : <CoverPlaceholder title={p.title} className="h-20 w-full" />}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{p.title}</span>
                <span className="block truncate font-mono text-[11px] text-faint">/{p.path}</span>
              </span>
              {p.url && (
                <Button variant="quiet" size="icon-sm" asChild>
                  <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Open ${p.title}`}>
                    <ExternalLink />
                  </a>
                </Button>
              )}
            </div>
          </li>
        ))}
        {drafts.map((d) => (
          <li key={d.id} className="bw-panel flex flex-col overflow-hidden opacity-90 hover:bg-raised">
            <Link to={draftHref(d.id)} className="flex flex-1 flex-col">
              <CoverPlaceholder title={d.title} className="h-20 w-full" />
              <span className="flex flex-col gap-0.5 px-3 py-2.5">
                <span className="truncate text-[13px] font-semibold text-ink">{d.title}</span>
                <span className="text-[11px] text-faint">Page draft · edited {timeAgo(d.updatedAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pages.length > 0 && (
        <p className="pt-3 text-[11px] text-muted-foreground">
          Pages are your site's hand-built HTML; edit them in the site's code. Blackwall publishes posts.
        </p>
      )}
    </>
  )
}
