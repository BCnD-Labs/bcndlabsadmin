import { CheckCircle2, Globe, Loader2, RefreshCw, Rocket, TriangleAlert } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StatusMarker } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import type { Site, SitePage } from "@/lib/types"
import { useConnections } from "@/services/connector"
import { liveConfirmed } from "@shared/site-live"
import { siteOrigin } from "@shared/sitebuilder"
import { confirmLive, deployedAt, publishSite, usePublishRuns, useUnpublished } from "./use-cms"
export function pageState(p: SitePage, site: Site): "published" | "changed" | "draft" {
  const since = deployedAt(site)
  if (!since || p.createdAt > since) return "draft"
  return p.updatedAt > since ? "changed" : "published"
}
export const STATE_LABEL = { published: "Up to date", changed: "Changed", draft: "New" } as const
const TONE = { published: "ok", changed: "warn", draft: "off" } as const

export function StateChip({ state }: { state: keyof typeof STATE_LABEL }) {
  return <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase" title={state === "published" ? "Nothing changed since you last got or published the files" : state === "changed" ? "Edited since you last got or published the files" : "Not in your last files yet"}><StatusMarker tone={TONE[state]} />{STATE_LABEL[state]}</span>
}

/** What has changed since the files last left Blackwall, with the ways to get them out: copy/download always, publish when a repository is connected. */
export function PublishBar({ site }: { site: Site }) {
  const changes = useUnpublished(site)
  const { list, refresh } = useConnections()
  const run = usePublishRuns((s) => s.runs[site.id])
  const busy = run?.state === "publishing"
  useEffect(() => { void refresh() }, [refresh])
  const since = deployedAt(site)
  const repo = list.some((c) => c.provider === "website")
  const what = [changes.pages.length && `${changes.pages.length} page${changes.pages.length === 1 ? "" : "s"}`, changes.posts.length && `${changes.posts.length} post${changes.posts.length === 1 ? "" : "s"}`, changes.settings && !since ? "the whole site" : changes.settings && "site settings"].filter(Boolean).join(", ")
  const dirty = !!what
  const last = site.publishedAt && site.publishedAt === since ? `Last published ${timeAgo(site.publishedAt)}${site.publishedSha ? ` (${site.publishedSha.slice(0, 7)})` : ""}.` : site.exportedAt && site.exportedAt === since ? `You last got the files ${timeAgo(site.exportedAt)}.` : "Get the files when you're ready to put it online."
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] bg-raised px-3 py-2.5" role="status">
      <StatusMarker tone={dirty ? "warn" : "ok"} />
      <span className="min-w-[12rem] flex-1 text-[13px]">
        {!since ? <b className="text-ink">Nothing has left Blackwall yet. </b> : dirty ? <><b className="text-ink">Changed since then: {what}.</b> </> : <b className="text-ink">Everything is up to date. </b>}
        <span className="text-muted-foreground">{last}</span>
      </span>
      {site.domain && <Button variant="ghost" size="sm" asChild><a href={siteOrigin(site.domain)} target="_blank" rel="noreferrer"><Globe /> Open site</a></Button>}
      {repo && <Button size="sm" disabled={busy || !dirty} onClick={() => { publishSite(site).catch((e: Error) => toast.error(e.message)) }}>
        <Rocket /> {busy ? "Publishing…" : "Publish changes"}
      </Button>}
    </div>
  )
}

/** After a publish: is the real site showing it? Says exactly which pages aren't, and never claims more than it checked. */
export function LiveStatus({ site }: { site: Site }) {
  const run = usePublishRuns((s) => s.runs[site.id])
  if (!run) return null
  const again = () => void confirmLive(site, "removed" in run ? run.removed : [], 1)
  const row = "flex flex-wrap items-center gap-2 text-[12.5px]"
  if (run.state === "publishing") return <p className={row} data-testid="live-status" data-state="publishing"><Loader2 className="size-3.5 animate-spin" /> Publishing…</p>
  if (run.state === "checking") return <p className={row} data-testid="live-status" data-state="checking"><Loader2 className="size-3.5 animate-spin" /> Published. Waiting for your live site to show it…</p>
  if (run.state === "failed") return <p className={`${row} text-red-text`} data-testid="live-status" data-state="failed"><TriangleAlert className="size-3.5" /> {run.message} <Button variant="outline" size="xs" onClick={again}>Try the check again</Button></p>
  const { report } = run
  if (!report.origin) return <p className={row} data-testid="live-status" data-state="no-domain">Published. Add your domain in Settings so Blackwall can confirm it's live.</p>
  if (liveConfirmed(report)) return <p className={`${row} text-green`} data-testid="live-status" data-state="confirmed"><CheckCircle2 className="size-3.5" /> Confirmed live: {report.pages.length} {report.pages.length === 1 ? "page matches" : "pages match"} what you published{report.removed.length ? `, ${report.removed.length} removed ${report.removed.length === 1 ? "page is" : "pages are"} gone` : ""}.</p>
  const off = [...report.pages, ...report.removed].filter((p) => p.state !== "current" && p.state !== "gone")
  const say = { old: "still the old version", missing: "not found", "still-there": "still online", current: "", gone: "" }
  return (
    <div className="grid gap-1 text-[12.5px]" data-testid="live-status" data-state="not-yet">
      <p className="flex flex-wrap items-center gap-2 text-amber"><TriangleAlert className="size-3.5" /> Not live yet: {off.length} of {report.pages.length + report.removed.length} {off.length === 1 ? "page doesn't" : "pages don't"} match.<Button variant="outline" size="xs" onClick={again}><RefreshCw /> Check again</Button></p>
      <ul className="grid gap-0.5 font-mono text-[11.5px] text-ink-2">{off.slice(0, 8).map((p) => <li key={p.path}>{p.path}: {say[p.state]}</li>)}</ul>
    </div>
  )
}
