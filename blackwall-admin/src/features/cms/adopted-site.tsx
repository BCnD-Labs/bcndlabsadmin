import { ExternalLink, FileText, Layers, RefreshCw, Save, Settings2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { adoptedPreview, type AdoptedPageFile, type SiteScan } from "@shared/site-adopt"
import { CARD_TOKENS, DEFAULT_CARD_TEMPLATE, cardIssues, renderCard, type SitePost } from "@shared/site"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { StatusMarker } from "@/components/common/tags"
import { postsHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import { cn } from "@/lib/utils"
import { api } from "@/services/connector"
import { forConnection } from "@/services/site"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { ScaledFrame } from "./site-preview"

/* A site Blackwall adopted: hand-written pages in a repository. Blackwall reads them, shows them, and writes only the text
   between `<!-- blackwall:NAME -->` markers the owner put there. Nothing here builds or republishes the whole site. */

const scans = new Map<string, Promise<SiteScan>>()

/** What a scan of the site's repository found. Cached for the session; `refresh` reads it again. */
export function useScan(site: Site) {
  const conn = site.connectionId ?? ""
  const [state, setState] = useState<{ scan?: SiteScan; error?: string; loading: boolean }>({ loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    if (!conn) { setState({ loading: false, error: "This site isn't connected to a repository yet." }); return }
    if (tick > 0) scans.delete(conn)
    let p = scans.get(conn)
    if (!p) {
      p = api<SiteScan>(forConnection("site/scan", conn))
      p.catch(() => scans.delete(conn))
      scans.set(conn, p)
    }
    setState((s) => ({ ...s, loading: true }))
    p.then((scan) => live && setState({ scan, loading: false })).catch((e) => live && setState({ error: (e as Error).message, loading: false }))
    return () => { live = false }
  }, [conn, tick])
  return { ...state, refresh: () => setTick((n) => n + 1) }
}

/** One hand-written page as it is in the repository now. */
export function useAdoptedPage(site: Site, path: string | undefined) {
  const conn = site.connectionId ?? ""
  const [state, setState] = useState<{ page?: AdoptedPageFile; error?: string; loading: boolean }>({ loading: !!path })
  const load = useCallback(async () => {
    if (!path || !conn) { setState({ loading: false }); return }
    setState((s) => ({ ...s, loading: true, error: undefined }))
    try {
      setState({ page: await api<AdoptedPageFile>(forConnection(`site/page?path=${encodeURIComponent(path)}`, conn)), loading: false })
    } catch (e) {
      setState({ error: (e as Error).message, loading: false })
    }
  }, [conn, path])
  useEffect(() => { void load() }, [load])
  return { ...state, reload: load, set: (page: AdoptedPageFile) => setState({ page, loading: false }) }
}

/** The front page of an adopted site, small enough for a card. */
export function AdoptedThumb({ site }: { site: Site }) {
  const { scan, error } = useScan(site)
  const home = scan?.pages.find((p) => p.path === "index.html") ?? scan?.pages[0]
  const { page } = useAdoptedPage(site, home?.path)
  const html = useMemo(() => (page && scan ? adoptedPreview(page.html, scan.siteUrl, page.path, page.styles) : ""), [page, scan])
  if (html) return <ScaledFrame html={html} title={`${site.name} home page`} />
  return <div className="grid aspect-[16/10] place-items-center bg-well px-3 text-center text-xs text-muted-foreground">{error ? "Couldn't read this site's repository" : "Reading the site…"}</div>
}

/** The small status lines on an adopted site's card: only what the scan found. */
export function adoptedSummary(scan: SiteScan | undefined, error: string | undefined) {
  if (error) return { tone: "warn" as const, text: "Can't reach the repository", detail: error }
  if (!scan) return { tone: "off" as const, text: "Reading the repository…", detail: "" }
  const pages = `${scan.pages.length}${scan.morePages ? "+" : ""} ${scan.pages.length === 1 ? "page" : "pages"}`
  return { tone: "ok" as const, text: "Run from its own files", detail: `${pages} · ${scan.posts} ${scan.posts === 1 ? "post" : "posts"} · ${scan.repo}@${scan.branch}` }
}

const SNIPPET = (name: string) => `<!-- blackwall:${name} -->\n  …what Blackwall may change…\n<!-- /blackwall:${name} -->`

/** One marked region: its text, and a Save that writes only this region. */
function RegionEditor({ site, page, region, onSaved }: { site: Site; page: AdoptedPageFile; region: { name: string; text: string }; onSaved: (page: AdoptedPageFile) => void }) {
  const [text, setText] = useState(region.text)
  const [busy, setBusy] = useState(false)
  useEffect(() => setText(region.text), [region.text, page.sha])
  const dirty = text !== region.text
  const save = async () => {
    setBusy(true)
    try {
      const r = await api<AdoptedPageFile & { changed: boolean }>(forConnection("site/region", site.connectionId), { method: "PUT", body: JSON.stringify({ path: page.path, name: region.name, content: text, baseSha: page.sha }) })
      onSaved(r)
      toast.success(r.changed ? `Saved “${region.name}”` : "Nothing changed", { description: r.changed ? "Committed to the repository; your host redeploys on its own." : undefined })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel category="website" title={region.name} meta="Editable region" actions={<Button size="xs" disabled={!dirty || busy} onClick={save}><Save /> {busy ? "Saving…" : "Save"}</Button>} bodyClassName="px-3 py-2.5">
      <Textarea aria-label={`${region.name} region`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={Math.min(18, Math.max(5, text.split("\n").length + 1))} className="font-mono text-xs" />
      <p className="mt-1.5 text-[11px] text-faint">Only the text between the markers changes. Everything else on this page stays exactly as you wrote it.</p>
    </Panel>
  )
}

/** Labeled sample posts, so the card template can be tried without touching real posts. */
const SAMPLES: SitePost[] = [
  { slug: "sample-featured", title: "A featured sample post", excerpt: "Featured posts are listed first.", tags: ["Week 1"], categories: ["Case Study", "Web"], featured: true, date: "2026-01-02T00:00:00.000Z", markdown: "" },
  { slug: "sample-plain", title: "A plain sample post", excerpt: "", tags: [], date: "2026-01-01T00:00:00.000Z", markdown: "" },
]

/** The markup of one blog card for this site, with {{tokens}}. Saved on the site; used the next time a post is published or removed. */
function CardTemplatePanel({ site }: { site: Site }) {
  const update = useWorkspace((s) => s.update)
  const saved = site.cardTemplate ?? DEFAULT_CARD_TEMPLATE
  const [text, setText] = useState(saved)
  useEffect(() => setText(saved), [saved])
  const issues = cardIssues(text)
  const preview = useMemo(() => (issues.length ? "" : `<style>body{font:14px system-ui;margin:12px}.card{border:1px solid #8884;border-radius:8px;padding:10px;margin:0 0 10px}.chips{display:flex;gap:4px;list-style:none;padding:0;margin:0 0 6px}.chip{background:#8882;border-radius:99px;padding:1px 8px;font-size:11px}.post-thumb{max-width:100%}h3{margin:.2em 0}</style>${SAMPLES.map((p) => renderCard(p, "#", text)).join("\n")}`), [text, issues.length])
  const dirty = text !== saved
  return (
    <Panel category="website" title="Post cards" meta="Blog list" actions={<><Button variant="quiet" size="xs" disabled={text === DEFAULT_CARD_TEMPLATE} onClick={() => setText(DEFAULT_CARD_TEMPLATE)}>Reset</Button><Button size="xs" disabled={!dirty || issues.length > 0} onClick={() => { update("sites", site.id, { cardTemplate: text === DEFAULT_CARD_TEMPLATE ? undefined : text }); toast.success("Card template saved", { description: "It is used the next time a post is published or removed." }) }}><Save /> Save</Button></>} bodyClassName="grid gap-2 px-3 py-2.5">
      <Textarea aria-label="Blog card template" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={8} className="font-mono text-xs" />
      {issues.length > 0 && <ul role="alert" className="grid gap-0.5 text-[11px] text-red-text">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer text-ink-2">Tokens</summary>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">{CARD_TOKENS.map((t) => <><dt key={t.token} className="font-mono text-ink-2">{`{{${t.token}}}`}</dt><dd key={`${t.token}-d`}>{t.about}</dd></>)}</dl>
      </details>
      {preview ? <iframe title="Card preview" srcDoc={preview} sandbox="" className="h-44 w-full rounded-md border border-line-soft bg-white" /> : null}
      <p className="text-[11px] text-faint">The preview uses two made-up sample posts. Blackwall only writes the markup and the data-category and data-featured attributes; filtering is up to your site's own script.</p>
    </Panel>
  )
}

/** The workspace for an adopted site: its pages, the page as visitors see it, and the regions Blackwall may edit. */
export function AdoptedWorkspace({ site }: { site: Site }) {
  const [params, setParams] = useSearchParams()
  const { scan, error, loading, refresh } = useScan(site)
  const path = params.get("page") ?? scan?.pages.find((p) => p.path === "index.html")?.path ?? scan?.pages[0]?.path
  const { page, error: pageError, loading: pageLoading, reload, set } = useAdoptedPage(site, path)
  const html = useMemo(() => (page && scan ? adoptedPreview(page.html, scan.siteUrl, page.path, page.styles) : ""), [page, scan])
  const status = adoptedSummary(scan, error)
  return (
    <>
      <PageHeader
        title={site.name}
        subtitle={site.domain || scan?.siteUrl || "Run from its own files"}
        actions={
          <>
            <Button variant="outline" onClick={() => { refresh(); void reload() }}><RefreshCw /> Refresh</Button>
            {(site.domain || scan?.siteUrl) && <Button variant="outline" asChild><a href={scan?.siteUrl || `https://${site.domain}`} target="_blank" rel="noreferrer"><ExternalLink /> Open live site</a></Button>}
            <Button asChild><Link to={postsHref}><Layers /> Posts</Link></Button>
          </>
        }
      />
      <div className="grid gap-[var(--bw-grid-gap)] lg:grid-cols-[16rem_minmax(0,1fr)_22rem]" data-testid="adopted-workspace">
        <div className="grid content-start gap-[var(--bw-grid-gap)]">
          <Panel category="website" title="Pages" meta={scan ? `${scan.pages.length}${scan.morePages ? "+" : ""}` : undefined} bodyClassName="max-h-[60dvh] overflow-y-auto py-1">
            {loading && !scan ? <p className="px-3.5 py-3 text-xs text-muted-foreground">Reading the repository…</p> : error ? <p className="px-3.5 py-3 text-xs text-red-text">{error}</p> : (
              <ul>
                {scan?.pages.map((p) => (
                  <li key={p.path}>
                    <button type="button" onClick={() => setParams({ page: p.path }, { replace: true })} aria-current={p.path === path ? "page" : undefined} className={cn("block w-full px-3.5 py-1.5 text-left hover:bg-raised", p.path === path && "bg-selected")}>
                      <b className="block truncate text-[13px] text-ink">{p.title}</b>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">{p.path}</span>
                    </button>
                  </li>
                ))}
                {scan && scan.morePages > 0 && <li className="px-3.5 py-2 text-[11px] text-faint">{scan.morePages} more not listed</li>}
              </ul>
            )}
          </Panel>
          <Panel category="website" title="This site" actions={<Button variant="quiet" size="xs" onClick={() => useUi.getState().openSettings("connections", "website")}><Settings2 /> Connection</Button>} bodyClassName="grid gap-1.5 px-3.5 py-3 text-xs">
            <p className="flex items-center gap-1.5 text-ink-2"><StatusMarker tone={status.tone} />{status.text}</p>
            {scan && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                <dt>Repository</dt><dd className="truncate font-mono text-ink-2">{scan.repo}@{scan.branch}</dd>
                <dt>Posts folder</dt><dd className="truncate font-mono text-ink-2">{scan.postsDir}</dd>
                <dt>Blog index</dt><dd className="truncate font-mono text-ink-2">{scan.blogIndex}{!scan.blogIndexFound ? " (not found)" : !scan.indexMarkers ? " (no posts region)" : ""}</dd>
                <dt>Images folder</dt><dd className="truncate font-mono text-ink-2">{scan.imagesDir}</dd>
              </dl>
            )}
            <p className="text-[11px] text-faint">Folder names are settings of this site's connection. Change them under Connection.</p>
          </Panel>
        </div>

        <Panel category="website" title={page?.title ?? "Page"} meta={path} bodyClassName="bg-well p-2">
          {html ? <ScaledFrame html={html} title={`${page?.title ?? "Page"} as visitors see it`} width={1100} aspect={4 / 5} /> : (
            <EmptyState icon={FileText} title={pageLoading ? "Reading the page…" : pageError ? "Couldn't read this page" : "No page chosen"}>{pageError ?? (scan?.pages.length === 0 ? "No .html pages were found in this repository." : "")}</EmptyState>
          )}
        </Panel>

        <div className="grid content-start gap-[var(--bw-grid-gap)]">
          <CardTemplatePanel site={site} />
          {page && page.regions.length > 0 ? page.regions.map((r) => <RegionEditor key={r.name} site={site} page={page} region={r} onSaved={set} />) : (
            <Panel category="website" title="Editable regions" bodyClassName="grid gap-2 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              <p>{page ? "This page is yours: Blackwall shows it but doesn't change it." : "Choose a page to see which parts Blackwall may edit."}</p>
              {page && (
                <>
                  <p>To let Blackwall edit one part, wrap it in two comments in your own file. Only the text between them is ever changed:</p>
                  <pre className="overflow-x-auto rounded-md bg-well p-2 font-mono text-[11px] text-ink-2">{SNIPPET("intro")}</pre>
                </>
              )}
              {pageError && page && <Button variant="outline" size="sm" onClick={() => void reload()}>Reload the page</Button>}
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
