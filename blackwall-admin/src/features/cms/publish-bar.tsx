import { Globe, Rocket } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StatusMarker } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import type { Site, SitePage } from "@/lib/types"
import { useConnections } from "@/services/connector"
import { deployedAt, publishSite, useUnpublished } from "./use-cms"
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
  const [busy, setBusy] = useState(false)
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
      {site.domain && <Button variant="ghost" size="sm" asChild><a href={`https://${site.domain}`} target="_blank" rel="noreferrer"><Globe /> Open site</a></Button>}
      {repo && <Button size="sm" disabled={busy || !dirty} onClick={async () => { setBusy(true); try { await publishSite(site) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }}>
        <Rocket /> {busy ? "Publishing…" : "Publish changes"}
      </Button>}
    </div>
  )
}
