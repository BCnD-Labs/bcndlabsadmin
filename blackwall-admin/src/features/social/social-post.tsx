import { format, parseISO } from "date-fns"
import { Check, Copy, ExternalLink, Trash2, Undo2 } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { platformDef, postAccounts, postState } from "@shared/social"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { Field, OptionSelect } from "@/components/forms/fields"
import { socialHref } from "@/lib/routes"
import type { SocialAccount, SocialPost } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { PostStateChip } from "./social-page"
import { PlatformBadge } from "./social-ui"

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error("Couldn't copy", { description: "Your browser blocked the clipboard." })
  }
}

/** One account's kit: copy each piece, open the app, then mark it posted (with the live link if you like). */
function KitRow({ post, account }: { post: SocialPost; account: SocialAccount }) {
  const update = useWorkspace((s) => s.update)
  const def = platformDef(account.platform)
  const done = post.posted.find((x) => x.accountId === account.id)
  const [url, setUrl] = useState(done?.url ?? "")
  const open = def.compose?.(post.body, post.link, post.title) || account.url || def.home
  const over = def.limit && post.body.length > def.limit
  const markPosted = () => update("socialPosts", post.id, { posted: [...post.posted.filter((x) => x.accountId !== account.id), { accountId: account.id, at: new Date().toISOString(), url: url.trim() || undefined }] })
  return (
    <li className="grid gap-2 border-t border-line-soft px-3.5 py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-2">
        <PlatformBadge platform={account.platform} />
        <b className="min-w-0 flex-1 truncate text-[13px] text-ink">{account.name} <span className="font-normal text-muted-foreground">· {account.brand}</span></b>
        {done && <span className="flex items-center gap-1 text-[11.5px] text-green"><Check className="size-3.5" /> {format(parseISO(done.at), "MMM d")}</span>}
      </div>
      {over && <p className="text-[11.5px] text-amber">{post.body.length - def.limit!} characters over {def.label}'s {def.limit}.</p>}
      <div className="flex flex-wrap gap-1.5">
        {post.title && <Button size="xs" variant="outline" onClick={() => copy(post.title, "Title")}><Copy /> Title</Button>}
        {post.body && <Button size="xs" variant="outline" onClick={() => copy(post.body, "Text")}><Copy /> Text</Button>}
        {post.link && <Button size="xs" variant="outline" onClick={() => copy(post.link!, "Link")}><Copy /> Link</Button>}
        {open && <Button size="xs" variant="outline" asChild><a href={open} target="_blank" rel="noreferrer"><ExternalLink /> {def.compose ? `Open ${def.label} with text` : `Open ${def.label}`}</a></Button>}
      </div>
      {done ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {done.url ? <a href={done.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-muted-foreground hover:underline">{done.url}</a> : <span className="flex-1 text-xs text-faint">Posted</span>}
          <Button size="xs" variant="ghost" onClick={() => update("socialPosts", post.id, { posted: post.posted.filter((x) => x.accountId !== account.id) })}><Undo2 /> Not posted</Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Input className="h-7 min-w-0 flex-1 text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Live post link (optional)" aria-label={`Live post link for ${account.name}`} />
          <Button size="xs" variant="outline" onClick={markPosted}><Check /> Posted</Button>
        </div>
      )}
    </li>
  )
}

const toLocalInput = (iso?: string) => (iso ? format(parseISO(iso), "yyyy-MM-dd'T'HH:mm") : "")

/** Social → one post: write it, pick accounts and a time, then post by hand from the kit. */
export function SocialPostPage() {
  const { id = "" } = useParams()
  const post = useWorkspace((s) => s.socialPosts.find((p) => p.id === id))
  const accounts = useWorkspace((s) => s.socialAccounts)
  const { update, remove } = useWorkspace.getState()
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()

  if (!post) {
    return (
      <>
        <PageHeader title="Post not found" back={{ to: socialHref, label: "Social" }} />
        <Panel category="social" title="Post"><EmptyState title="This post doesn't exist" action={<Button variant="outline" asChild><Link to={socialHref}>Back to Social</Link></Button>}>It may have been deleted.</EmptyState></Panel>
      </>
    )
  }

  const set = (patch: Partial<SocialPost>) => update("socialPosts", post.id, patch)
  const mine = postAccounts(post, accounts)
  const limits = mine.map((a) => platformDef(a.platform)).filter((p) => p.limit)
  const tightest = limits.sort((a, b) => a.limit! - b.limit!)[0]
  const brands = [...new Set(accounts.map((a) => a.brand))]
  const toggle = (aid: string, on: boolean) => set({ accountIds: on ? [...post.accountIds, aid] : post.accountIds.filter((x) => x !== aid) })
  const del = () => {
    remove("socialPosts", post.id)
    toast("Post deleted")
    navigate(socialHref)
  }
  const all = [post.title, post.body, post.link].filter(Boolean).join("\n\n")

  return (
    <>
      <PageHeader title={post.title || "Untitled post"} back={{ to: socialHref, label: "Social" }} badge={<PostStateChip state={postState(post)} />} actions={<Button variant="ghost" onClick={del}><Trash2 /> Delete</Button>} />
      <WorkspaceGrid>
        <GridItem span={2}>
          <Panel category="social" title="Post" bodyClassName="grid content-start gap-3.5 px-3.5 py-3">
            <Field label="Title" htmlFor="sp-title" hint="For you, and for platforms that have one (Reddit, YouTube).">
              <Input id="sp-title" value={post.title} onChange={(e) => set({ title: e.target.value })} placeholder="Week 3 garden update" />
            </Field>
            <Field label="Text" htmlFor="sp-body" hint={tightest ? `${post.body.length} / ${tightest.limit} (${tightest.label} is the shortest limit here)` : `${post.body.length} characters`}>
              <Textarea id="sp-body" rows={9} value={post.body} onChange={(e) => set({ body: e.target.value })} placeholder="Caption, hashtags and all" className={cn(tightest && post.body.length > tightest.limit! && "ring-1 ring-amber")} />
            </Field>
            <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
              <Field label="Link" htmlFor="sp-link"><Input id="sp-link" type="url" value={post.link ?? ""} onChange={(e) => set({ link: e.target.value || undefined })} placeholder="https://bcndlabs.dev/posts/…" /></Field>
              <Field label="Stage" htmlFor="sp-stage"><OptionSelect id="sp-stage" value={post.stage} onChange={(stage) => set({ stage })} options={[{ value: "idea", label: "Idea" }, { value: "draft", label: "Draft" }, { value: "ready", label: "Ready" }]} className="w-full" /></Field>
            </div>
            <Field label="Photo / video" htmlFor="sp-media" hint="Where the file is (a Nextcloud link, a filename) and any notes for it.">
              <Textarea id="sp-media" rows={2} value={post.media ?? ""} onChange={(e) => set({ media: e.target.value || undefined })} placeholder="Nextcloud › Sprouts › tomato-harvest.jpg · crop square for IG" />
            </Field>
            <div className="flex justify-end"><Button variant="outline" size="sm" disabled={!all} onClick={() => copy(all, "Everything")}><Copy /> Copy all</Button></div>
          </Panel>
        </GridItem>
        <GridItem span={2}>
          <Panel category="social" title="Where & when" bodyClassName="grid content-start gap-3 px-3.5 py-3">
            <Field label="Post at" htmlFor="sp-when" hint="You get a reminder then (bell and phone, per Settings → Notifications).">
              <div className="flex gap-1.5">
                <Input id="sp-when" type="datetime-local" value={toLocalInput(post.scheduledAt)} onChange={(e) => set({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
                {post.scheduledAt && <Button variant="ghost" size="sm" onClick={() => set({ scheduledAt: undefined })}>Clear</Button>}
              </div>
            </Field>
            <div className="grid gap-1">
              <span className="text-[13px] font-medium text-ink-2">Accounts</span>
              {accounts.length ? brands.map((b) => (
                <fieldset key={b} className="grid gap-1 py-1">
                  <legend className="mb-1 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">{b}</legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {accounts.filter((a) => a.brand === b).map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-[13px] text-ink-2">
                        <Checkbox checked={post.accountIds.includes(a.id)} onCheckedChange={(v) => toggle(a.id, v === true)} />
                        <PlatformBadge platform={a.platform} />{a.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )) : <p className="text-xs text-muted-foreground">No accounts yet. <button type="button" className="underline" onClick={() => openForm({ kind: "socialAccount" })}>Add one</button>.</p>}
            </div>
          </Panel>
          <Panel category="social" title="Post kit" className="mt-[var(--bw-grid-gap)]" meta={mine.length ? `${post.posted.filter((x) => post.accountIds.includes(x.accountId)).length} of ${mine.length} posted` : undefined} bodyClassName="flex flex-col">
            {mine.length ? <ul>{mine.map((a) => <KitRow key={a.id} post={post} account={a} />)}</ul> : <p className="px-3.5 py-3 text-xs text-muted-foreground">Pick accounts above: each gets copy buttons, an Open button and a Posted check.</p>}
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
