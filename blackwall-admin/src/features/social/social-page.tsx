import { format, isToday, isTomorrow, parseISO } from "date-fns"
import { Megaphone, Plus, UserPlus } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { matchesFilter, postAccounts, postState, type PostState } from "@shared/social"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { FilterChips } from "@/components/common/filter-chips"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { StatusMarker, type Tone } from "@/components/common/tags"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { timeFmt } from "@/lib/dates"
import { socialPostHref } from "@/lib/routes"
import type { SocialPost } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { AccountChip, PlatformBadge, useSocialFilter } from "./social-ui"

export const STATE_LABEL: Record<PostState, string> = { idea: "Idea", draft: "Draft", scheduled: "Scheduled", due: "Time to post", partial: "Partly posted", posted: "Posted" }
const TONE: Record<PostState, Tone> = { idea: "off", draft: "off", scheduled: "off", due: "error", partial: "warn", posted: "ok" }

export function PostStateChip({ state }: { state: PostState }) {
  return <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase"><StatusMarker tone={TONE[state]} />{STATE_LABEL[state]}</span>
}

const dayLabel = (iso: string) => {
  const d = parseISO(iso)
  return isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEEE, MMM d")
}

function PostRow({ post }: { post: SocialPost }) {
  const accounts = useWorkspace((s) => s.socialAccounts)
  const mine = postAccounts(post, accounts)
  const state = postState(post)
  return (
    <li className="border-t border-line-soft first:border-t-0">
      <Link to={socialPostHref(post.id)} className="flex min-w-0 items-start gap-3 px-3.5 py-2.5 hover:bg-raised">
        <span className="w-14 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">{post.scheduledAt ? format(parseISO(post.scheduledAt), timeFmt()) : "—"}</span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13px] text-ink">{post.title || "Untitled post"}</b>
          {post.body && <span className="block truncate text-[12px] text-muted-foreground">{post.body}</span>}
          {mine.length > 0 && <span className="mt-1.5 flex flex-wrap gap-1">{mine.map((a) => <AccountChip key={a.id} account={a} done={post.posted.some((x) => x.accountId === a.id)} />)}</span>}
        </span>
        <PostStateChip state={state} />
      </Link>
    </li>
  )
}

function Group({ title, posts, meta }: { title: string; posts: SocialPost[]; meta?: string }) {
  if (!posts.length) return null
  return (
    <section>
      <h3 className="flex items-baseline justify-between bg-well/60 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase"><span>{title}</span>{meta && <span className="font-normal normal-case">{meta}</span>}</h3>
      <ul>{posts.map((p) => <PostRow key={p.id} post={p} />)}</ul>
    </section>
  )
}

/** Social: everything you plan to post, by when, filtered by platform and brand. Posting itself is by hand. */
export function SocialPage() {
  const posts = useWorkspace((s) => s.socialPosts)
  const accounts = useWorkspace((s) => s.socialAccounts)
  const create = useWorkspace((s) => s.create)
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()
  const f = useSocialFilter()

  const shown = posts.filter((p) => matchesFilter(p, accounts, f.platforms, f.brands))
  const withState = shown.map((p) => ({ p, s: postState(p) }))
  const due = withState.filter((x) => x.s === "due" || x.s === "partial").map((x) => x.p).sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
  const upcoming = withState.filter((x) => x.s === "scheduled").map((x) => x.p).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
  const days = [...new Set(upcoming.map((p) => format(parseISO(p.scheduledAt!), "yyyy-MM-dd")))]
  const unscheduled = withState.filter((x) => x.s === "idea" || x.s === "draft").map((x) => x.p).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const posted = withState.filter((x) => x.s === "posted").map((x) => x.p).sort((a, b) => (b.scheduledAt ?? b.updatedAt).localeCompare(a.scheduledAt ?? a.updatedAt)).slice(0, 15)
  const brands = [...new Set(accounts.map((a) => a.brand))]

  const newPost = () => {
    const p = create("socialPosts", { title: "", body: "", stage: "idea", accountIds: f.platforms.length || f.brands.length ? f.visibleAccounts.map((a) => a.id) : [], posted: [] })
    navigate(socialPostHref(p.id))
  }

  return (
    <>
      <PageHeader title="Social" actions={<Button onClick={newPost}><Plus /> Post</Button>} />
      <WorkspaceGrid>
        {accounts.length > 0 && (
          <GridItem span="full">
            <div className="bw-panel grid content-start gap-2 px-3.5 py-2.5">
              {f.platformOptions.length > 1 && <FilterChips label="Platforms" options={f.platformOptions} value={f.platforms} onChange={f.setPlatforms} />}
              {f.brandOptions.length > 1 && <FilterChips label="Brands" options={f.brandOptions} value={f.brands} onChange={f.setBrands} />}
              {f.platformOptions.length <= 1 && f.brandOptions.length <= 1 && <p className="text-xs text-muted-foreground">Add accounts on more platforms or brands to filter by them.</p>}
            </div>
          </GridItem>
        )}
        <GridItem span={3}>
          <Panel category="social" title="Queue" meta={`${upcoming.length} scheduled · ${unscheduled.length} not scheduled`} bodyClassName="flex flex-col">
            {shown.length ? (
              <>
                <Group title="Time to post" posts={due} />
                {days.map((d) => <Group key={d} title={dayLabel(`${d}T12:00:00`)} posts={upcoming.filter((p) => format(parseISO(p.scheduledAt!), "yyyy-MM-dd") === d)} />)}
                <Group title="Not scheduled" meta="ideas and drafts" posts={unscheduled} />
                <Group title="Posted" meta="most recent" posts={posted} />
              </>
            ) : (
              <EmptyState icon={Megaphone} title={posts.length ? "Nothing matches these filters" : "Plan your first post"} action={<Button variant="outline" onClick={newPost}><Plus /> Post</Button>}>
                Write it once, pick the accounts, set a time. When it's due you get a reminder and a copy-ready kit for each account.
              </EmptyState>
            )}
          </Panel>
        </GridItem>
        <GridItem>
          <Panel category="social" title="Accounts" meta={accounts.length || undefined} actions={<Button variant="ghost" size="xs" onClick={() => openForm({ kind: "socialAccount" })}><UserPlus /> Account</Button>} bodyClassName="py-1">
            {accounts.length ? brands.map((b) => (
              <section key={b} className="py-1">
                <h3 className="px-3.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">{b}</h3>
                <ul>
                  {accounts.filter((a) => a.brand === b).map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => openForm({ kind: "socialAccount", id: a.id })} className="flex w-full min-w-0 items-center gap-2.5 px-3.5 py-1.5 text-left hover:bg-raised">
                        <PlatformBadge platform={a.platform} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.name}</span>
                        <span className="text-[11px] text-faint">{posts.filter((p) => p.accountIds.includes(a.id) && postState(p) !== "posted").length || ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )) : (
              <p className="px-3.5 py-3 text-xs text-muted-foreground">Add your accounts (Instagram, TikTok, X…) and tag each with its brand: Personal, BCnD Labs, Sprouts & Scraps.</p>
            )}
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
