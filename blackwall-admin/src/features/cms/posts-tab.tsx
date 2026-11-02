import { FileText, Plus } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { ContentPage } from "@/features/content/content-page"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { timeAgo } from "@/lib/dates"
import { draftHref } from "@/lib/routes"
import type { Draft, Site } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { PublishBar, StateChip } from "./pages-tab"
import { SiteSwitcher } from "./site-switcher"
import { useCurrentSite } from "./use-cms"

const postState = (d: Draft, site: Site) => (!d.publishedAt ? "draft" : !site.publishedAt || d.updatedAt > site.publishedAt || d.publishedAt > site.publishedAt ? "changed" : "published")

/** Website → Posts. With no Blackwall site yet, the classic posts page for your connected website. */
export function CmsPostsPage() {
  const site = useCurrentSite()
  const drafts = useWorkspace((s) => s.drafts)
  const update = useWorkspace((s) => s.update)
  const createDraft = useCreateDraft()
  const navigate = useNavigate()
  if (!site) return <ContentPage />

  const posts = drafts.filter((d) => d.siteId === site.id && d.kind === "post")
  const loose = drafts.filter((d) => !d.siteId && d.kind === "post")
  const lastWeek = Math.max(0, ...posts.map((p) => p.week ?? 0))
  const lastCourse = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((p) => p.course)?.course
  const newPost = () => navigate(draftHref(createDraft({ siteId: site.id, week: lastWeek || undefined, course: lastCourse }).id))
  const sorted = [...posts].sort((a, b) => (b.week ?? -1) - (a.week ?? -1) || b.updatedAt.localeCompare(a.updatedAt))

  return (
    <>
      <PageHeader title="Website" badge={<SiteSwitcher />} actions={<Button onClick={newPost}><Plus /> Post</Button>} />
      <WorkspaceGrid>
        <GridItem span="full"><PublishBar site={site} /></GridItem>
        <GridItem span={3}>
          <Panel category="website" title="Posts" meta={`${posts.filter((p) => p.publishedAt).length} published · ${posts.filter((p) => !p.publishedAt).length} draft${posts.filter((p) => !p.publishedAt).length === 1 ? "" : "s"}`}>
            {sorted.length ? (
              <table className="w-full table-fixed text-left text-[13px]">
                <thead className="text-[11px] text-faint"><tr><th className="py-2 pl-3.5 font-normal">Post</th><th className="hidden w-36 font-normal sm:table-cell">Course · week</th><th className="hidden w-24 font-normal md:table-cell">Due</th><th className="w-36 font-normal">Status</th><th className="hidden w-24 pr-3 font-normal md:table-cell">Edited</th></tr></thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id} className="border-t border-line-soft hover:bg-raised">
                      <td className="py-2 pl-3.5"><Link to={draftHref(p.id)} className="block min-w-0"><b className="block truncate text-ink">{p.title || "Untitled"}</b>{p.excerpt && <span className="block truncate text-[11.5px] text-muted-foreground">{p.excerpt}</span>}</Link></td>
                      <td className="hidden text-xs text-muted-foreground sm:table-cell">{[p.course, p.week != null && `Week ${p.week}`].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="hidden text-xs text-muted-foreground md:table-cell">{p.due ?? "—"}</td>
                      <td><StateChip state={postState(p, site)} /></td>
                      <td className="hidden pr-3 text-xs text-muted-foreground md:table-cell">{timeAgo(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={FileText} title="No posts on this site yet" action={<Button variant="outline" onClick={newPost}><Plus /> Post</Button>}>
                Give a post a week and course and it lands in the right week of your course portal.
              </EmptyState>
            )}
          </Panel>
        </GridItem>
        <GridItem>
          <Panel category="website" title="Other drafts" meta={loose.length || undefined} bodyClassName="py-1">
            {loose.length ? (
              <ul>
                {loose.slice(0, 12).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 px-3.5 py-1.5">
                    <Link to={draftHref(d.id)} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline">{d.title || "Untitled"}</Link>
                    <Button variant="outline" size="xs" onClick={() => update("drafts", d.id, { siteId: site.id })}>Move here</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="px-3.5 py-3 text-xs text-muted-foreground">Drafts not on any site show here, so you can move them onto {site.name}.</p>}
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
