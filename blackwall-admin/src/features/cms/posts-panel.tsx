import { FileText, Plus } from "lucide-react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { ContentPage } from "@/features/content/content-page"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { timeAgo } from "@/lib/dates"
import { cmsPagesHref, draftHref } from "@/lib/routes"
import type { Draft, Site } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { StateChip } from "./publish-bar"
import { ScheduledList } from "./scheduled-list"
import { useCurrentSite } from "./use-cms"

const postState = (d: Draft, site: Site) => (!d.publishedAt ? "draft" : !site.publishedAt || d.updatedAt > site.publishedAt || d.publishedAt > site.publishedAt ? "changed" : "published")

/** /cms/posts: the workspace with Posts showing, or the classic posts page for a connected website when there is no Blackwall site yet. */
export function CmsPostsRoute() {
  const site = useCurrentSite()
  const { search } = useLocation()
  if (!site) return <ContentPage />
  // A site run from its own files keeps the classic Posts page, now pointed at that site's repository.
  if (site.adopted) return <ContentPage adopted={site} />
  const q = new URLSearchParams(search)
  q.set("panel", "posts")
  return <Navigate to={`${cmsPagesHref}?${q}`} replace />
}

/** Starts a post on the site, carrying over the course and week of the latest one. */
export function useNewPost(site: Site | undefined) {
  const drafts = useWorkspace((s) => s.drafts)
  const createDraft = useCreateDraft()
  const navigate = useNavigate()
  return () => {
    const posts = drafts.filter((d) => d.siteId === site?.id && d.kind === "post")
    const lastWeek = Math.max(0, ...posts.map((p) => p.week ?? 0))
    const lastCourse = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((p) => p.course)?.course
    navigate(draftHref(createDraft({ siteId: site?.id, week: lastWeek || undefined, course: lastCourse }).id))
  }
}

/** All of the site's posts, and drafts that aren't on any site yet. */
export function PostsPanel({ site }: { site: Site }) {
  const drafts = useWorkspace((s) => s.drafts)
  const update = useWorkspace((s) => s.update)
  const newPost = useNewPost(site)
  const posts = drafts.filter((d) => d.siteId === site.id && d.kind === "post")
  const loose = drafts.filter((d) => !d.siteId && d.kind === "post")
  const sorted = [...posts].sort((a, b) => (b.week ?? -1) - (a.week ?? -1) || b.updatedAt.localeCompare(a.updatedAt))
  const live = posts.filter((p) => p.publishedAt).length

  return (
    <div className="grid content-start gap-[var(--bw-grid-gap)]">
      <Panel category="website" title="Posts" meta={`${live} published · ${posts.length - live} draft${posts.length - live === 1 ? "" : "s"}`} actions={<Button variant="outline" size="xs" onClick={newPost}><Plus /> Post</Button>}>
        {sorted.length ? (
          <ul>
            {sorted.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-t border-line-soft px-3.5 py-2 first:border-t-0 hover:bg-raised">
                <Link to={draftHref(p.id)} className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] text-ink">{p.title || "Untitled"}</b>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{[p.course, p.week != null && `Week ${p.week}`, p.due && `Due ${p.due}`, timeAgo(p.updatedAt)].filter(Boolean).join(" · ")}</span>
                </Link>
                <StateChip state={postState(p, site)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileText} title="No posts on this site yet" action={<Button variant="outline" onClick={newPost}><Plus /> Post</Button>}>
            Give a post a week and course and it lands in the right week of your course portal.
          </EmptyState>
        )}
      </Panel>
      <ScheduledList pick={(s) => s.siteId === site.id} />
      {loose.length > 0 && (
        <Panel category="website" title="Other drafts" meta={loose.length} bodyClassName="py-1">
          <ul>
            {loose.slice(0, 12).map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-3.5 py-1.5">
                <Link to={draftHref(d.id)} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline">{d.title || "Untitled"}</Link>
                <Button variant="outline" size="xs" onClick={() => update("drafts", d.id, { siteId: site.id })}>Move here</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
