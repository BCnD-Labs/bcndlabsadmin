import { WorkspaceGrid, GridItem } from "@/components/common/workspace-grid"
import { useWorkspaceSync } from "@/services/workspace-sync"
import { format } from "date-fns"
import { CalendarClock, ExternalLink, FileX, ImagePlus, Loader2, Rocket, Trash2, Undo2, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { joinUrl, renderPostPage, type SiteChrome } from "@shared/site"
import { assetPath, imagePathsInPost } from "@shared/assets"
import { renderPost } from "@shared/sitebuilder"
import { AssetField } from "@/features/assets/asset-field"
import { chooseAsset } from "@/features/assets/asset-flow"
import { usePreviewPictures } from "@/features/assets/use-assets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { LiveStatus } from "@/features/cms/publish-bar"
import { SitePreview } from "@/features/cms/site-preview"
import { deployedAt, publishSite as publishSiteNow, selectSite } from "@/features/cms/use-cms"
import { useConnections } from "@/services/connector"
import { SourceBadge } from "@/components/common/source-badge"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { Field, OptionSelect, ProjectSelect } from "@/components/forms/fields"
import { slugify } from "@/lib/ids"
import { timeAgo, timeFmt } from "@/lib/dates"
import { postsHref, siteFilesHref } from "@/lib/routes"
import type { Draft, DraftKind } from "@/lib/types"
import { cn } from "@/lib/utils"
import { draftToPost, localImages, mergePosts, uploadSiteImage, useSite, useSiteChrome, useSiteStore, type PostItem } from "@/services/site"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { PostStateChip, postUrl } from "./content-page"
import { SiteImage } from "./site-image"

const KINDS: { value: DraftKind; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "page", label: "Page" },
]

export function PostEditor() {
  const { id = "" } = useParams()
  const saved = useWorkspace((s) => s.drafts.find((d) => d.id === id))
  return saved ? (
    <Editor key={id} draft={saved} />
  ) : (
    <>
      <PageHeader title="Post not found" back={{ to: postsHref, label: "Posts" }} />
      <Panel tool="post" command={`open ${id}`}>
        <EmptyState icon={FileX} title="This post doesn't exist" action={<Button asChild variant="outline"><Link to={postsHref}>Back to posts</Link></Button>}>
          It may have been deleted.
        </EmptyState>
      </Panel>
    </>
  )
}

type Editable = Pick<Draft, "title" | "slug" | "kind" | "excerpt" | "body" | "projectId" | "tags" | "cover" | "coverAlt" | "siteId" | "week" | "course" | "due">
const pick = (d: Draft): Editable => ({ title: d.title, slug: d.slug, kind: d.kind, excerpt: d.excerpt, body: d.body, projectId: d.projectId, tags: d.tags ?? [], cover: d.cover, coverAlt: d.coverAlt, siteId: d.siteId, week: d.week, course: d.course, due: d.due })

function Editor({ draft }: { draft: Draft }) {
  const update = useWorkspace((s) => s.update)
  const remove = useWorkspace((s) => s.remove)
  const navigate = useNavigate()
  const site = useSite()
  const live = site.status === "live" && !!site.overview
  const value = pick(draft)
  const [slugTouched, setSlugTouched] = useState(draft.slug !== slugify(draft.title) || !!draft.remoteSlug)
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  /** A post on one of your Blackwall sites (Pagesmith) rather than the classic connected website. */
  const pagesmith = useWorkspace((s) => s.sites.find((x) => x.id === draft.siteId))
  const siteOfPost = draft.siteId
  useEffect(() => { if (siteOfPost) selectSite(siteOfPost) }, [siteOfPost])

  // Put keystrokes in the workspace immediately. Only network saves are debounced,
  // so incoming server updates cannot be mistaken for unsaved editor changes.
  const set = (patch: Partial<Editable>) => {
    const next = { ...value, ...patch }
    if (patch.title !== undefined && !slugTouched) next.slug = slugify(patch.title) || "untitled"
    update("drafts", draft.id, { ...next, slug: slugify(next.slug) || "untitled" })
  }
  const dirty = false

  // The current local copy, as the publish panel sees it.
  const current: Draft = { ...draft, ...value, slug: slugify(value.slug) || "untitled" }
  const item = mergePosts([current], site.overview).find((i) => i.draft?.id === draft.id)

  const insertImage = async (file: File) => {
    try {
      const img = await uploadSiteImage(file)
      const el = bodyRef.current
      const md = `![${file.name.replace(/\.[^.]+$/, "")}](${img.path})`
      const at = el ? el.selectionStart : value.body.length
      set({ body: `${value.body.slice(0, at)}${at && !value.body.slice(0, at).endsWith("\n") ? "\n\n" : ""}${md}\n${value.body.slice(at)}` })
      toast.success("Image added to the site and the post")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const words = value.body.trim() ? value.body.trim().split(/\s+/).length : 0

  return (
    <>
      <PageHeader
        back={{ to: postsHref, label: "Posts" }}
        title={value.kind === "page" ? "Page draft" : "Post editor"}
        badge={value.kind === "post" && <PostStateChip state={item?.state ?? "draft"} edited={item?.edited} date={item?.date} />}
        subtitle={
          <span aria-live="polite" data-testid="save-state">
            {dirty ? "Saving…" : `Edited ${timeAgo(draft.updatedAt)}`} · {words} {words === 1 ? "word" : "words"}
          </span>
        }
        actions={
          confirmDelete ? (
            <>
              <span className="text-[11px] text-ink-2">{item && item.state !== "draft" ? "Delete your local copy? The post stays on the site." : "Delete this draft?"}</span>
              <Button variant="destructive" onClick={() => { remove("drafts", draft.id); toast("Draft deleted"); navigate(postsHref) }}>Delete</Button>
              <Button variant="quiet" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </>
          ) : (
            <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          )
        }
      />

      <WorkspaceGrid>
        <GridItem span={3}>
        <section className="bw-panel flex min-w-0 flex-col overflow-hidden" aria-label="Post">
          {value.kind === "post" && pagesmith && <SiteCoverPath cover={value.cover} alt={value.coverAlt} onChange={(cover, coverAlt) => set({ cover: cover || undefined, coverAlt: coverAlt || undefined })} />}
          {value.kind === "post" && !pagesmith && (
            <CoverField
              cover={value.cover}
              siteUrl={site.overview?.siteUrl}
              canUpload={live}
              onUpload={async (file) => {
                try {
                  const img = await uploadSiteImage(file)
                  set({ cover: img.path })
                  toast.success(item?.state === "published" ? "Cover uploaded. Update the post to show it on the site." : "Cover uploaded")
                } catch (e) {
                  toast.error((e as Error).message)
                }
              }}
              onRemove={() => set({ cover: undefined, coverAlt: undefined })}
            />
          )}
          <div className="flex flex-col gap-1 px-4 pt-3">
            <label htmlFor="post-title" className="sr-only">Title</label>
            <input
              id="post-title"
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Post title"
              className="w-full bg-transparent font-heading text-xl leading-tight font-bold text-ink outline-none placeholder:text-faint"
            />
            <label htmlFor="post-excerpt" className="sr-only">Excerpt</label>
            <textarea
              id="post-excerpt"
              rows={1}
              value={value.excerpt}
              onChange={(e) => set({ excerpt: e.target.value.replace(/\n/g, " ") })}
              placeholder="A one-line summary for the blog card…"
              className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-muted-foreground outline-none placeholder:text-faint"
            />
          </div>
          <div className="mt-2 flex items-center gap-2 border-y border-line px-3 py-1.5">
            <SegmentedTabs
              label="Editor view"
              value={tab}
              onChange={setTab}
              className="w-44"
              tabs={[
                { value: "write", label: "Write" },
                { value: "preview", label: "Preview" },
              ]}
            />
            {tab === "write" && !pagesmith && (
              <ImageButton disabled={!live} onFile={insertImage}>
                <ImagePlus /> Image
              </ImageButton>
            )}
            {tab === "write" && pagesmith && (
              <Button type="button" variant="ghost" size="sm" onClick={() => chooseAsset((a) => {
                const el = bodyRef.current
                const md = `![${a.alt || a.name}](${assetPath(a)})`
                const at = el ? el.selectionStart : value.body.length
                set({ body: `${value.body.slice(0, at)}${at && !value.body.slice(0, at).endsWith("\n") ? "\n\n" : ""}${md}\n${value.body.slice(at)}` })
              })}><ImagePlus /> Picture</Button>
            )}
            <span className="ml-auto hidden text-[11px] text-faint sm:inline">{tab === "write" ? (pagesmith ? "Markdown: ## heading, **bold**, [link](https://…). Use Picture for images." : "Markdown") : pagesmith ? `As it will look on ${pagesmith.name}` : site.overview ? `As it will look on ${site.overview.siteUrl.replace(/^https?:\/\//, "")}` : "Without your site's styles (not connected)"}</span>
          </div>
          {tab === "write" ? (
            <textarea
              ref={bodyRef}
              aria-label="Body (Markdown)"
              value={value.body}
              onChange={(e) => set({ body: e.target.value })}
              placeholder={"Write in Markdown…\n\n## A heading\nSome **bold** text, a [link](https://example.com), and images from the Image button."}
              className="min-h-[22rem] w-full max-w-[76ch] flex-1 resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:text-faint"
            />
          ) : (
            pagesmith ? <SitePostPreview draft={current} /> : <Preview draft={current} live={live} date={item?.state !== "draft" ? item?.date : undefined} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-2 text-[11px] text-muted-foreground">
            <span>{words} {words === 1 ? "word" : "words"} · Markdown</span>
            <span aria-live="polite" data-testid="editor-save-state">{dirty ? "Saving…" : <EditorSyncLabel />}</span>
          </div>
        </section>

        </GridItem>
        <GridItem><aside className="flex min-w-0 flex-col gap-3 self-start lg:sticky lg:top-[calc(var(--bw-header-h,92px)+0.25rem)]">
          {value.kind === "post" && draft.siteId ? (
            <SitePostPanel draft={draft} />
          ) : value.kind === "post" ? (
            <PublishPanel draft={current} item={item} site={site} onRemoteSlug={(remoteSlug) => update("drafts", draft.id, { ...value, slug: slugify(value.slug) || "untitled", remoteSlug })} />
          ) : (
            <Panel category="website" title="Page draft" tool="page" command="publish" bodyClassName="px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              Blackwall publishes posts. Your site's pages are hand-built HTML; use this draft to write the copy, then paste it into the page.
            </Panel>
          )}
          <Panel category="website" title="Post details" tool="post" command="details" bodyClassName="flex flex-col gap-3 px-3.5 py-3">
            <Field label="URL slug" htmlFor="post-slug" hint={item?.state === "published" && item.remote && slugify(value.slug) !== item.remote.slug ? "Changing it moves the post to a new address when you update." : undefined}>
              <Input id="post-slug" className="font-mono text-xs md:text-xs" value={value.slug} onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value }) }} />
            </Field>
            {value.kind === "post" && (
              <Field label="Tags" htmlFor="post-tags" hint="Shown as chips on the post and its blog card.">
                <TagInput id="post-tags" value={value.tags ?? []} onChange={(tags) => set({ tags })} />
              </Field>
            )}
            {value.kind === "post" && value.cover && (
              <Field label="Cover description" htmlFor="post-cover-alt" hint="For screen readers and when the image can't load.">
                <Input id="post-cover-alt" value={value.coverAlt ?? ""} onChange={(e) => set({ coverAlt: e.target.value })} />
              </Field>
            )}
            {value.kind === "post" && (
              <>
                <Field label="Site" htmlFor="post-site" hint={draft.siteId ? "Published with this site from the Website section." : "Pick a Blackwall site to publish this post with it."}>
                  <SiteSelect id="post-site" value={value.siteId} onChange={(siteId) => set({ siteId })} />
                </Field>
                <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                  <Field label="Week" htmlFor="post-week"><Input id="post-week" inputMode="numeric" value={value.week ?? ""} onChange={(e) => set({ week: e.target.value.trim() === "" ? undefined : Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} placeholder="10" /></Field>
                  <Field label="Course" htmlFor="post-course"><Input id="post-course" value={value.course ?? ""} onChange={(e) => set({ course: e.target.value || undefined })} placeholder="ADD 103" list="post-courses" /></Field>
                </div>
                <Field label="Due" htmlFor="post-due" hint="Week, course and due date place it in your course portal.">
                  <Input id="post-due" type="date" value={value.due ?? ""} onChange={(e) => set({ due: e.target.value || undefined })} />
                </Field>
              </>
            )}
            <div className="grid gap-3">
              <Field label="Type" htmlFor="post-kind">
                <OptionSelect id="post-kind" value={value.kind} onChange={(kind) => set({ kind })} options={KINDS} />
              </Field>
              <Field label="Project" htmlFor="post-project">
                <ProjectSelect id="post-project" value={value.projectId} onChange={(projectId) => set({ projectId })} />
              </Field>
            </div>
          </Panel>
        </aside></GridItem>
      </WorkspaceGrid>
    </>
  )
}

function ImageButton({ disabled, onFile, children }: { disabled?: boolean; onFile: (f: File) => void | Promise<void>; children: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        disabled={disabled || busy}
        title={disabled ? "Connect your website to upload images" : "Upload an image to the site and insert it"}
        onClick={() => ref.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : null}
        {children}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f) return
          setBusy(true)
          await onFile(f)
          setBusy(false)
        }}
      />
    </>
  )
}

/** Cover image: drop or pick a file; it's committed to the site's images folder straight away. */
function CoverField({ cover, siteUrl, canUpload, onUpload, onRemove }: { cover?: string; siteUrl?: string; canUpload: boolean; onUpload: (f: File) => Promise<void>; onRemove: () => void }) {
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const take = async (f?: File) => {
    if (!f || !canUpload) return
    setBusy(true)
    await onUpload(f)
    setBusy(false)
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void take(e.dataTransfer.files?.[0])
  }
  const input = <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f) }} />

  if (cover)
    return (
      <div className="group relative border-b border-line" onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}>
        <SiteImage path={cover} siteUrl={siteUrl} className="h-40 w-full sm:h-44" />
        <div className={cn("absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100", (busy || over) && "opacity-100")}>
          <Button variant="ghost" size="sm" disabled={!canUpload || busy} onClick={() => ref.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X /> Remove
          </Button>
        </div>
        {input}
      </div>
    )
  return (
    <div className="px-3 pt-3">
      <button
        type="button"
        disabled={!canUpload || busy}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn(
          "flex min-h-8 w-full items-center justify-start px-3 py-2 gap-2 rounded-[8px] border border-dashed border-ledge-hi bg-well text-xs text-muted-foreground transition-colors hover:border-rim hover:text-ink disabled:hover:border-ledge-hi disabled:hover:text-muted-foreground",
          over && "border-ink-2 text-ink",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {canUpload ? "Add a cover image: drop it here or click" : "Cover images require a website connection"}
      </button>
      {input}
    </div>
  )
}

function TagInput({ id, value, onChange }: { id: string; value: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("")
  const add = () => {
    const t = text.trim().replace(/,$/, "")
    if (t && !value.includes(t) && value.length < 8) onChange([...value, t])
    setText("")
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add()
    } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div className="flex min-h-[30px] flex-wrap items-center gap-1 rounded-[8px] border border-input bg-well px-1.5 py-1 focus-within:border-ink-2/40">
      {value.map((t) => (
        <span key={t} className="inline-flex h-5 items-center gap-1 rounded-[4px] bg-selected pr-0.5 pl-1.5 text-[11px] text-ink-2">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-[3px] text-faint hover:text-ink">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input id={id} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={value.length ? "" : "Week 11, Notes…"} className="h-5 min-w-16 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint md:text-xs" />
    </div>
  )
}

/** The post rendered with the site's own header and styles, in a sandboxed frame (no scripts). */
function Preview({ draft, live, date }: { draft: Draft; live: boolean; date?: string }) {
  const site = useSite()
  const chrome = useSiteChrome(live)
  const html = useMemo(() => buildPreview(draft, chrome, site.overview?.siteUrl, site.overview?.blogUrl, date), [draft, chrome, site.overview, date])
  return <iframe title="Post preview" srcDoc={html} sandbox="allow-same-origin" className="min-h-[65vh] w-full flex-1 border-0 bg-white" />
}

const FALLBACK_CSS = `<style>body{font-family:system-ui,sans-serif;line-height:1.65;color:#1d2127;margin:0;padding:2rem 1.25rem}.container{max-width:46rem;margin:0 auto}.chips{display:flex;gap:.4rem;list-style:none;padding:0}.chip{font-size:.75rem;border:1px solid #ccd;border-radius:999px;padding:.1rem .6rem}</style>`

function buildPreview(draft: Draft, chrome: SiteChrome, siteUrl?: string, blogUrl?: string, date?: string) {
  const post = draftToPost(draft, date)
  const blogHref = blogUrl ? new URL(blogUrl).pathname : "/"
  let html = renderPostPage(post, chrome.head ? chrome : { ...chrome, head: FALLBACK_CSS }, blogHref, { baseHref: siteUrl ? `${siteUrl}/` : undefined })
  // Images uploaded this session may not be on the live site yet.
  for (const [path, blob] of localImages) html = html.split(`"${path}"`).join(`"${blob}"`).split(`(${path})`).join(`(${blob})`)
  // Links in the preview open in a new tab instead of navigating the frame.
  return html.replace("<head>", '<head><base target="_blank">')
}

/** Publish / schedule / update / unpublish, depending on where the post is. */
function PublishPanel({ draft, item, site, onRemoteSlug }: { draft: Draft; item?: PostItem; site: ReturnType<typeof useSite>; onRemoteSlug: (slug: string | undefined) => void }) {
  const { publish, schedule, unschedule, unpublish } = useSiteStore()
  const [busy, setBusy] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [when, setWhen] = useState(() => format(new Date(Date.now() + 24 * 3600_000), "yyyy-MM-dd'T'09:00"))

  if (site.status !== "live" || !site.overview) {
    return (
      <Panel category="website" title="Publishing" tool="post" command="publish" badge={<SourceBadge status={site.status} />} bodyClassName="flex flex-col items-start gap-2 px-3.5 py-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {site.status === "loading"
            ? "Checking your website…"
            : site.status === "error"
              ? `Couldn't reach your site's repository: ${site.error}`
              : "Connect your website to publish this post, schedule it, and update it later. Your draft is part of your shared Blackwall workspace."}
        </p>
        {site.status !== "loading" && (
          <Button variant="outline" size="sm" onClick={() => useUi.getState().openSettings("connections", "website")}>
            {site.status === "error" ? "Connection settings" : "Connect website"}
          </Button>
        )}
      </Panel>
    )
  }

  const state = item?.state ?? "draft"
  const url = state === "published" ? postUrl(site.overview.postsUrl, item!.slug) : undefined
  const problems = [!draft.title.trim() && "Add a title", !draft.body.trim() && "Write something"].filter(Boolean) as string[]
  const previousSlug = draft.remoteSlug && draft.remoteSlug !== draft.slug ? draft.remoteSlug : undefined

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const doPublish = () =>
    run("publish", async () => {
      const r = await publish(draftToPost(draft), previousSlug)
      onRemoteSlug(draft.slug)
      toast.success(state === "published" ? "Post updated" : "Published", {
        description: "It's live once your site finishes redeploying, usually a minute or two.",
        action: r.url ? { label: "View", onClick: () => window.open(r.url, "_blank", "noreferrer") } : undefined,
      })
    })
  const doSchedule = () =>
    run("schedule", async () => {
      const at = new Date(when)
      if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) throw new Error("Pick a time in the future")
      if (previousSlug) await unschedule(previousSlug).catch(() => {})
      await schedule(draftToPost(draft, at.toISOString()), at.toISOString())
      onRemoteSlug(draft.slug)
      setScheduling(false)
      toast.success(`Scheduled for ${format(at, `EEE MMM d, ${timeFmt()}`)}`)
    })

  return (
    <Panel category="website" title="Publishing" tool="post" command="publish" bodyClassName="flex flex-col gap-2.5 px-3.5 py-3" badge={<><SourceBadge status={site.status} /><PostStateChip state={state} edited={item?.edited} /></>}>
      {state === "published" && item?.date && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Published {format(new Date(item.date), "MMM d, yyyy")}
          {item.remote?.updated && <> · updated {timeAgo(item.remote.updated)}</>}
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 truncate font-mono text-[11px] text-ink-2 hover:text-ink hover:underline">
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </p>
      )}
      {state === "scheduled" && item?.date && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Publishes <span className="text-ink">{format(new Date(item.date), `EEE, MMM d 'at' ${timeFmt()}`)}</span>. Blackwall's server publishes it then, even if this tab is closed.
          {item.scheduled?.error && <span className="mt-1 block text-red-text">Last try failed: {item.scheduled.error}</span>}
        </p>
      )}
      {state === "draft" && <p className="text-xs leading-relaxed text-muted-foreground">Workspace draft. Publish it now or pick a time.</p>}
      {item?.edited && <p className="text-xs text-amber">You've changed it since it was {state === "scheduled" ? "scheduled" : "published"}.</p>}
      {problems.length > 0 && <p className="text-[11px] text-muted-foreground">{problems.join(" · ")} before publishing.</p>}

      <div className="flex flex-col gap-1.5">
        {state === "published" ? (
          <Button variant={item?.edited ? "default" : "ghost"} onClick={doPublish} disabled={!!busy || problems.length > 0 || !item?.edited}>
            {busy === "publish" ? <Loader2 className="animate-spin" /> : <Rocket />} {item?.edited ? "Update post" : "Up to date"}
          </Button>
        ) : (
          <Button onClick={doPublish} disabled={!!busy || problems.length > 0}>
            {busy === "publish" ? <Loader2 className="animate-spin" /> : <Rocket />} Publish now
          </Button>
        )}
        {state === "scheduled" && item?.edited && (
          <Button variant="ghost" disabled={!!busy || problems.length > 0} onClick={() => { setWhen(format(new Date(item.date!), "yyyy-MM-dd'T'HH:mm")); void doScheduleAt(item.date!) }}>
            Save changes to the schedule
          </Button>
        )}
        {state !== "published" &&
          (scheduling ? (
            <div className="flex flex-col gap-1.5 rounded-[8px] border border-line bg-well p-2">
              <label htmlFor="publish-at" className="text-[11px] text-muted-foreground">Publish at</label>
              <Input id="publish-at" type="datetime-local" value={when} min={format(new Date(), "yyyy-MM-dd'T'HH:mm")} onChange={(e) => setWhen(e.target.value)} />
              <div className="flex gap-1.5">
                <Button size="sm" className="flex-1" disabled={!!busy || problems.length > 0} onClick={doSchedule}>
                  {busy === "schedule" ? <Loader2 className="animate-spin" /> : <CalendarClock />} Schedule
                </Button>
                <Button size="sm" variant="quiet" onClick={() => setScheduling(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" disabled={!!busy} onClick={() => { if (item?.date && state === "scheduled") setWhen(format(new Date(item.date), "yyyy-MM-dd'T'HH:mm")); setScheduling(true) }}>
              <CalendarClock /> {state === "scheduled" ? "Change time" : "Schedule…"}
            </Button>
          ))}
        {state === "scheduled" && (
          <Button variant="quiet" disabled={!!busy} onClick={() => run("unschedule", async () => { await unschedule(item!.slug); onRemoteSlug(undefined); toast.success("Unscheduled; it's a draft again") })}>
            <Undo2 /> Unschedule
          </Button>
        )}
        {state === "published" && (
          <Button variant="quiet" disabled={!!busy} onClick={() => run("unpublish", async () => { await unpublish(item!.slug); onRemoteSlug(undefined); toast.success("Removed from the site. Your draft is still here.") })}>
            {busy === "unpublish" ? <Loader2 className="animate-spin" /> : <Undo2 />} Unpublish
          </Button>
        )}
      </div>
      <p className="border-t border-line-soft pt-2 text-[10px] leading-relaxed text-faint">
        Commits to {site.overview.repo} ({site.overview.branch}). {joinUrl(site.overview.siteUrl, "").replace(/^https?:\/\//, "").replace(/\/$/, "")} redeploys on its own.
      </p>
    </Panel>
  )

  async function doScheduleAt(iso: string) {
    await run("schedule", async () => {
      await schedule(draftToPost(draft, iso), iso)
      onRemoteSlug(draft.slug)
      toast.success("Scheduled post updated")
    })
  }
}

function EditorSyncLabel() {
  return useWorkspaceSync((s) => s.message)
}

function SiteSelect({ id, value, onChange }: { id: string; value?: string; onChange: (v: string | undefined) => void }) {
  const sites = useWorkspace((s) => s.sites)
  const courses = useWorkspace((s) => s.courses)
  return (
    <>
      <OptionSelect id={id} value={value ?? "none"} onChange={(v) => onChange(v === "none" ? undefined : v)} options={[{ value: "none", label: sites.length ? "Your connected website (classic)" : "No Blackwall sites yet" }, ...sites.map((x) => ({ value: x.id, label: x.name }))]} className="w-full" />
      <datalist id="post-courses">{[...new Set(courses.map((c) => c.code).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
    </>
  )
}

/** Site posts publish with their site: one click marks it live and publishes the site. */
function SitePostPanel({ draft }: { draft: Draft }) {
  const site = useWorkspace((s) => s.sites.find((x) => x.id === draft.siteId))
  const update = useWorkspace((s) => s.update)
  const { list, refresh } = useConnections()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  useEffect(() => { void refresh() }, [refresh])
  if (!site) return null
  const repo = list.some((c) => c.provider === "website")
  const since = deployedAt(site)
  const changed = !!draft.publishedAt && !!since && draft.updatedAt > since
  const state = !draft.publishedAt ? "draft" : changed || !since || draft.publishedAt > since ? "pending" : "live"
  const go = async (live: boolean) => {
    setBusy(true)
    try {
      update("drafts", draft.id, { publishedAt: live ? draft.publishedAt ?? new Date().toISOString() : undefined, status: live ? "ready" : draft.status })
      if (repo) await publishSiteNow(site)
      else toast.success(live ? "Added to the site" : "Taken off the site", { description: "It's in your files the next time you get them.", action: { label: "Get files", onClick: () => navigate(siteFilesHref) } })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel category="website" title="Publishing" subtitle={site.name} bodyClassName="flex flex-col gap-2.5 px-3.5 py-3">
      <p className="text-xs text-muted-foreground">
        {state === "draft" ? "A draft: it isn't part of the site yet." : state === "pending" ? (repo ? "Changes not published yet." : "On the site. It goes into your files the next time you get them.") : `On the site at /posts/${draft.slug}/ and in your latest files.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || (repo ? state === "live" : state !== "draft")} onClick={() => void go(true)}>{busy ? <Loader2 className="animate-spin" /> : <Rocket />} {repo ? (state === "draft" ? "Publish" : state === "pending" ? "Publish changes" : "Up to date") : (state === "draft" ? "Add to the site" : "On the site")}</Button>
        {draft.publishedAt && <Button variant="quiet" disabled={busy} onClick={() => void go(false)}><Undo2 /> {repo ? "Unpublish" : "Take off the site"}</Button>}
        {!repo && <Button variant="outline" asChild><Link to={siteFilesHref}>Get files</Link></Button>}
      </div>
      <LiveStatus site={site} />
      <p className="text-[11px] text-faint">{repo ? "Publishing rebuilds and commits the whole site, so the course portal and post lists update too." : "Adding a post puts it in the site's files, its blog list and its course pages. Then get the files and copy them over."}</p>
    </Panel>
  )
}

/** Pagesmith posts take their cover from the asset library only. */
function SiteCoverPath({ cover, alt, onChange }: { cover?: string; alt?: string; onChange: (cover: string, alt: string) => void }) {
  return (
    <div className="grid gap-2 border-b border-line px-4 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="grid gap-0.5 text-[11px] text-muted-foreground">Cover picture (optional)
        <AssetField value={cover ?? ""} onPick={(a) => onChange(assetPath(a), alt || a.alt)} onClear={() => onChange("", "")} />
      </div>
      <label className="grid content-start gap-0.5 text-[11px] text-muted-foreground">Describe it
        <Input value={alt ?? ""} onChange={(e) => onChange(cover ?? "", e.target.value)} placeholder="What's in the picture" className="h-8 text-xs" aria-label="Cover picture description" />
      </label>
    </div>
  )
}

/** The post as the site will show it: its own header, menu, colors and type. */
function SitePostPreview({ draft }: { draft: Draft }) {
  const site = useWorkspace((s) => s.sites.find((x) => x.id === draft.siteId))
  const pages = useWorkspace((s) => s.pages)
  const forms = useWorkspace((s) => s.forms)
  const own = useMemo(() => pages.filter((p) => p.siteId === draft.siteId), [pages, draft.siteId])
  const library = useWorkspace((s) => s.assets)
  const pictures = usePreviewPictures(imagePathsInPost(draft))
  const html = useMemo(() => (site ? renderPost(site, own, draft, { preview: true, forms, assets: library, assetUrls: pictures }) : ""), [site, own, draft, forms, library, pictures])
  return <SitePreview html={html} title="Post preview" className="min-h-[65vh] flex-1 rounded-none" />
}
