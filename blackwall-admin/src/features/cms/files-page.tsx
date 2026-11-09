import { AlertTriangle, Check, Copy, Download, FileCode2, Info, Rocket } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { SITE_IMAGES_DIR, assetCloudPath, humanBytes, usedAssets } from "@shared/assets"
import { buildSite, checkSite, type SiteIssue } from "@shared/sitebuilder"
import { makeZip } from "@shared/zip"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { draftHref, formsHref, postsHref, siteLookHref, siteSettingsHref, sitePageHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useConnections } from "@/services/connector"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { PublishBar } from "./pages-tab"
import { SiteSwitcher } from "./site-switcher"
import { SiteTabs } from "./site-tabs"
import { AssetImage } from "@/features/assets/asset-flow"
import { fetchFile } from "@/features/mikoshi/storage-api"
import { publishSite, saveFile, useCurrentSite } from "./use-cms"

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

/** The checks, one row per page (or per area of the site), problems before tips, each with its own plain-words lines. */
function groupIssues(issues: SiteIssue[], pages: { id: string; title: string }[]) {
  const map = new Map<string, { key: string; title: string; items: SiteIssue[]; go: ReturnType<typeof where> }>()
  for (const i of issues) {
    const key = i.pageId ?? i.area ?? "site"
    const title = i.pageId ? pages.find((p) => p.id === i.pageId)?.title || "Untitled page" : i.area === "settings" ? "Site settings" : i.area === "look" ? "Look" : i.area === "posts" ? "Posts" : "Site"
    const g = map.get(key) ?? { key, title, items: [], go: where(i) }
    g.items.push({ ...i, text: i.pageId && i.text.startsWith(`${title}: `) ? i.text.slice(title.length + 2).replace(/^./, (c) => c.toUpperCase()) : i.text })
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) => Number(b.items.some((i) => i.level === "fix")) - Number(a.items.some((i) => i.level === "fix")))
}

function where(i: SiteIssue) {
  if (i.pageId) return { to: sitePageHref(i.pageId), label: "Open page" }
  if (i.area === "settings") return { to: siteSettingsHref, label: "Settings" }
  if (i.area === "look") return { to: siteLookHref, label: "Look" }
  if (i.area === "forms") return { to: formsHref, label: "Forms" }
  if (i.area === "posts") return { to: postsHref, label: "Posts" }
  return null
}

/** Get files: the problems worth fixing first, then every file the site is made of, to download or copy. */
export function CmsFilesPage() {
  const site = useCurrentSite()
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const forms = useWorkspace((s) => s.forms)
  const { list, refresh } = useConnections()
  const [picked, setPicked] = useState("index.html")
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void refresh() }, [refresh])

  const library = useWorkspace((s) => s.assets)
  const files = useMemo(() => (site ? buildSite(site, pages, drafts, forms, [], library) : {}), [site, pages, drafts, forms, library])
  const issues = useMemo(() => (site ? checkSite(site, pages, drafts, forms, library) : []), [site, pages, drafts, forms, library])
  const pictures = useMemo(() => (site ? usedAssets(library, site.id, pages, drafts) : []), [site, library, pages, drafts])
  if (!site) return <><PageHeader title="Website" /><Panel category="website" title="Get files"><EmptyState title="No site yet" action={<Button onClick={() => useUi.getState().openForm({ kind: "site" })}>New site</Button>} /></Panel></>

  const pictureFile = (a: { file: string }) => `${SITE_IMAGES_DIR}/${a.file}`
  const paths = [...Object.keys(files), ...pictures.map(pictureFile)].sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)))
  const pictureAt = (path: string) => pictures.find((a) => pictureFile(a) === path)
  const shown = paths.includes(picked) ? picked : paths[0]
  const shownPicture = pictureAt(shown)
  const fix = issues.filter((i) => i.level === "fix")
  const groups = groupIssues(issues, pages)
  const repo = list.some((c) => c.provider === "website")
  const markExported = () => useWorkspace.getState().update("sites", site.id, { exportedAt: new Date(Date.now() + 1000).toISOString() })
  const zipName = `${site.domain || site.name}`.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "") || "site"
  const post = drafts.find((d) => d.siteId === site.id && d.kind === "post" && !d.publishedAt)

  return (
    <>
      <PageHeader title="Website" badge={<SiteSwitcher />} />
      <WorkspaceGrid>
        <GridItem span="full"><SiteTabs current="files" /></GridItem>
        <GridItem span="full"><PublishBar site={site} /></GridItem>
        <GridItem span={2}>
          <Panel category="website" title="Before you go live" meta={fix.length ? `${fix.length} to fix` : "all clear"} bodyClassName="p-0">
            {issues.length ? (
              <ul className="divide-y divide-line-soft">
                {groups.map((g) => (
                  <li key={g.key} className="flex items-start gap-2.5 px-3.5 py-2.5 text-[13px]" data-level={g.items.some((i) => i.level === "fix") ? "fix" : "tip"}>
                    {g.items.some((i) => i.level === "fix") ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-label="Fix" /> : <Info className="mt-0.5 size-3.5 shrink-0 text-faint" aria-label="Tip" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{g.title}</span>
                      <ul className="mt-0.5 grid gap-0.5 text-xs leading-snug text-ink-2">{g.items.map((i, n) => <li key={n} className={cn(i.level === "tip" && "text-muted-foreground")}>{i.text}</li>)}</ul>
                    </span>
                    {g.go && <Button size="xs" variant="outline" asChild><Link to={g.go.to}>{g.go.label}</Link></Button>}
                  </li>
                ))}
              </ul>
            ) : <p className="px-3.5 py-4 text-[13px] text-muted-foreground"><Check className="mr-1.5 inline size-3.5 text-green" />Nothing to fix. Every page has content, every link goes somewhere and the forms can send.</p>}
            {fix.length > 0 && <p className="border-t border-line-soft px-3.5 py-2 text-[11px] text-faint">You can still get the files with things left to fix; they're just what visitors would notice.</p>}
          </Panel>
        </GridItem>
        <GridItem span={2}>
          <Panel category="website" title="Put it online" bodyClassName="grid content-start gap-3 px-3.5 py-3 text-[13px]">
            <div className="grid gap-1.5">
              <Button onClick={async () => {
                try {
                  const all: Record<string, string | Uint8Array> = { ...files }
                  for (const a of pictures) all[pictureFile(a)] = new Uint8Array(await (await fetchFile(assetCloudPath(a))).arrayBuffer())
                  saveFile(`${zipName}.zip`, makeZip(all), "application/zip"); markExported()
                  toast.success(`Downloaded ${paths.length} files`, { description: "Unzip them into your site's folder." })
                } catch (e) { toast.error(`Couldn't get your pictures from Nextcloud: ${(e as Error).message}`) }
              }}><Download /> Download all {paths.length} files (.zip)</Button>
              <p className="text-xs text-muted-foreground">Unzip into your site's folder (or repository), replacing what's there, then upload or push it the way you do now.{site.root ? <> Blackwall's Settings say this site lives in <code className="font-mono">{site.root}/</code>.</> : null}</p>
            </div>
            {repo && (
              <div className="grid gap-1.5 border-t border-line-soft pt-3">
                <Button variant="outline" disabled={busy || fix.some((i) => i.area === "settings")} onClick={async () => { setBusy(true); try { await publishSite(site) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }}><Rocket /> {busy ? "Publishing…" : "Publish to your repository"}</Button>
                <p className="text-xs text-muted-foreground">One click: Blackwall writes these same files to your GitHub repository in a single commit.</p>
              </div>
            )}
            {pictures.length > 0 && (
              <div className="border-t border-line-soft pt-3">
                <p className="font-semibold text-ink">{pictures.length} {pictures.length === 1 ? "picture" : "pictures"} from your library</p>
                <p className="mb-1.5 text-xs text-muted-foreground">They're in the .zip, in the <span className="font-mono">images/</span> folder. Copying files one by one? Download these from the list below.</p>
                <ul className="grid gap-0.5 font-mono text-xs text-ink-2">{pictures.map((a) => <li key={a.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{pictureFile(a)}</span><span className="shrink-0 text-faint">{humanBytes(a.bytes)}</span></li>)}</ul>
              </div>
            )}
            {post && <p className="border-t border-line-soft pt-3 text-xs text-muted-foreground">Drafts stay out of the files until you publish them: <Link className="underline" to={draftHref(post.id)}>{post.title || "Untitled"}</Link>.</p>}
          </Panel>
        </GridItem>
        <GridItem span="full">
          <Panel category="website" title="Every file" meta={`${paths.length} files`} bodyClassName="p-0">
            <div className="grid @3xl/main:grid-cols-[16rem_minmax(0,1fr)]">
              <ul className="max-h-96 overflow-y-auto border-b border-line-soft @3xl/main:border-r @3xl/main:border-b-0" aria-label="Files">
                {paths.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => setPicked(p)} aria-current={p === shown} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs hover:bg-raised", p === shown && "bg-selected text-ink")}>
                      <FileCode2 className="size-3.5 shrink-0 text-faint" /><span className="min-w-0 flex-1 truncate">{p}</span><span className="shrink-0 text-[10.5px] text-faint">{files[p] !== undefined ? kb(files[p].length) : humanBytes(pictureAt(p)?.bytes ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-w-0">
                <div className="flex items-center gap-2 border-b border-line-soft px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{shown}</span>
                  {shownPicture ? <Button size="xs" variant="outline" onClick={() => void fetchFile(assetCloudPath(shownPicture)).then((b) => { saveFile(shownPicture.file, b, shownPicture.mime); markExported() }).catch((e: Error) => toast.error(e.message))}><Download /> Download</Button>
                    : <Button size="xs" variant="outline" onClick={() => { void navigator.clipboard.writeText(files[shown]).then(() => { setCopied(shown); markExported(); setTimeout(() => setCopied(null), 1500) }) }}>{copied === shown ? <><Check /> Copied</> : <><Copy /> Copy</>}</Button>}
                </div>
                {shownPicture ? <div className="grid place-items-center bg-[repeating-conic-gradient(#0003_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4"><AssetImage asset={shownPicture} className="max-h-80 max-w-full object-contain" /></div>
                  : <pre className="max-h-96 overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-ink-2" tabIndex={0}>{files[shown] || "(an empty file)"}</pre>}
              </div>
            </div>
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
