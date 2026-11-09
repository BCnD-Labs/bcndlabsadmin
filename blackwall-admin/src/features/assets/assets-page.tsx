import { Copy, ImageIcon, Pencil, Trash2 } from "lucide-react"
import { useMemo, useState, type DragEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { assetCloudPath, assetPath, assetUsage, humanBytes, sizeChange } from "@shared/assets"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { SiteSwitcher } from "@/features/cms/site-switcher"
import { SiteTabs } from "@/features/cms/site-tabs"
import { draftHref, sitePageHref } from "@/lib/routes"
import type { Asset } from "@/lib/types"
import { cn } from "@/lib/utils"
import { storage } from "@/features/mikoshi/storage-api"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { AddPictureButton, AssetImage, addFiles, editAsset } from "./asset-flow"
import { useAssetUrls, useStorageInfo } from "./use-assets"

function Detail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const sites = useWorkspace((s) => s.sites)
  const { update, remove } = useWorkspace.getState()
  const [confirm, setConfirm] = useState(false)
  const [trash, setTrash] = useState(false)
  const use = useMemo(() => assetUsage(asset, pages, drafts), [asset, pages, drafts])
  const used = use.pages.length + use.posts.length
  const siteName = (id?: string) => sites.find((s) => s.id === id)?.name ?? ""
  const del = async () => {
    remove("assets", asset.id)
    if (trash) await storage.remove(assetCloudPath(asset)).catch((e: Error) => toast.error(`Removed from the library, but Nextcloud said: ${e.message}`))
    toast(`${asset.name} removed from the library`, { description: trash ? "The file went to your Nextcloud trash." : "The file is still in your Nextcloud folder." })
    onClose()
  }
  return (
    <div className="flex max-h-[85dvh] flex-col">
      <div className="border-b border-line py-3 pr-12 pl-4"><DialogTitle className="font-heading text-base font-bold">{asset.name}</DialogTitle><DialogDescription className="font-mono text-xs">{assetPath(asset)}</DialogDescription></div>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-[8px] bg-[repeating-conic-gradient(#0003_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-1.5"><AssetImage asset={asset} className="max-h-[50dvh] w-full object-contain" /></div>
        <div className="grid min-w-0 content-start gap-2.5 text-[13px]">
          <div className="grid gap-1"><Label htmlFor="d-name" className="text-xs font-normal text-muted-foreground">Name</Label><Input id="d-name" className="h-8" value={asset.name} onChange={(e) => update("assets", asset.id, { name: e.target.value })} /></div>
          <div className="grid gap-1"><Label htmlFor="d-alt" className="text-xs font-normal text-muted-foreground">What it shows (alt text)</Label><Input id="d-alt" className="h-8" value={asset.alt} onChange={(e) => update("assets", asset.id, { alt: e.target.value })} placeholder="Used wherever you add it" /></div>
          <div className="grid gap-1"><Label htmlFor="d-tags" className="text-xs font-normal text-muted-foreground">Tags (commas)</Label><Input id="d-tags" className="h-8" value={(asset.tags ?? []).join(", ")} onChange={(e) => update("assets", asset.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></div>
          <dl className="grid gap-0.5 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Size</dt><dd className="text-ink">{asset.width} × {asset.height} px · {asset.mime.replace("image/", "").toUpperCase()} · {humanBytes(asset.bytes)}</dd></div>
            {asset.originalBytes ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Original</dt><dd className="text-ink">{asset.originalWidth} × {asset.originalHeight} · {humanBytes(asset.originalBytes)} ({sizeChange(asset.originalBytes, asset.bytes)})</dd></div> : null}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Kept in</dt><dd className="min-w-0 truncate font-mono text-ink" title={assetCloudPath(asset)}>{assetCloudPath(asset)}</dd></div>
            {asset.source && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Came from</dt><dd className="min-w-0 truncate font-mono text-ink" title={asset.source}>{asset.source.replace(/^nextcloud:|^device:/, (m) => (m === "device:" ? "this computer: " : "Nextcloud: "))}</dd></div>}
          </dl>
          <div className="border-t border-line-soft pt-2">
            <p className="text-xs font-semibold text-ink">{used ? `Used in ${used} place${used === 1 ? "" : "s"}` : "Not used anywhere yet"}</p>
            <ul className="mt-1 grid gap-0.5 text-xs">
              {use.pages.map((p) => <li key={p.id}><Link className="text-ink-2 underline" to={sitePageHref(p.id)} onClick={onClose}>{siteName(p.siteId)} · {p.title || "Untitled page"}</Link></li>)}
              {use.posts.map((p) => <li key={p.id}><Link className="text-ink-2 underline" to={draftHref(p.id)} onClick={onClose}>{siteName(p.siteId)} · post “{p.title || "Untitled"}”</Link></li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        {confirm ? (
          <>
            <span className="min-w-0 flex-1 text-xs text-ink-2">{used ? `It's used in ${used} place${used === 1 ? "" : "s"}; those pictures will show as missing.` : "Remove it from the library?"}</span>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={trash} onChange={(e) => setTrash(e.target.checked)} /> Also move the file to Nextcloud's trash</label>
            <Button variant="quiet" onClick={() => setConfirm(false)}>Keep</Button><Button variant="destructive" onClick={() => void del()}>Remove</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => { onClose(); void editAsset(asset) }}><Pencil /> Edit picture</Button>
            <Button variant="outline" onClick={() => void navigator.clipboard.writeText(assetPath(asset)).then(() => toast.success("Copied the site path"))}><Copy /> Copy site path</Button>
            <Button variant="quiet" className="ml-auto text-red-text" onClick={() => setConfirm(true)}><Trash2 /> Remove…</Button>
          </>
        )}
      </div>
    </div>
  )
}

/** Asset library: your pictures, prepared once (cropped, shrunk, in the right file type) and kept in Nextcloud. Pagesmith can only use pictures from here. */
export function AssetsPage() {
  const assets = useWorkspace((s) => s.assets)
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const folder = usePrefs((s) => s.assetsFolder)
  const setPrefs = usePrefs((s) => s.set)
  const info = useStorageInfo()
  const [q, setQ] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const urls = useAssetUrls(assets)
  const shown = useMemo(() => [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((a) => !q || `${a.name} ${a.file} ${a.alt} ${(a.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase())), [assets, q])
  const opened = assets.find((a) => a.id === open)
  const connected = info && info !== "error" && info.connected
  const total = assets.reduce((n, a) => n + a.bytes, 0)
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]) }

  return (
    <>
      <PageHeader title="Website" badge={<SiteSwitcher />} />
      <WorkspaceGrid>
        <GridItem span="full"><SiteTabs current="assets" /></GridItem>
        {info && !connected && (
          <GridItem span="full">
            <p role="status" className="bw-panel flex flex-wrap items-center gap-3 px-4 py-3 text-[13px] text-ink-2">
              <span className="min-w-0 flex-1">{info === "error" ? "Couldn't reach the Blackwall server, so the library can't load pictures." : "Nextcloud isn't connected. The library keeps its pictures there."}</span>
              {info !== "error" && <Button size="sm" onClick={() => useUi.getState().openSettings("connections")}>Connect Nextcloud</Button>}
            </p>
          </GridItem>
        )}
        <GridItem span="full">
          <Panel category="website" title="Asset library" meta={assets.length ? `${assets.length} · ${humanBytes(total)}` : undefined} actions={<AddPictureButton />} bodyClassName="p-0">
            <div onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop} className={cn("min-h-56 transition-colors", over && "bg-selected")}>
              {assets.length > 0 && <div className="border-b border-line-soft px-3 py-2"><Input aria-label="Search pictures" className="h-8 w-full max-w-xs text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, description or tag" /></div>}
              {shown.length ? (
                <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Pictures" data-testid="asset-grid">
                  {shown.map((a) => {
                    const use = assetUsage(a, pages, drafts)
                    const n = use.pages.length + use.posts.length
                    return (
                      <li key={a.id}>
                        <button type="button" onClick={() => setOpen(a.id)} className="group w-full overflow-hidden rounded-[10px] bg-raised text-left ring-1 ring-line-soft transition hover:ring-2 hover:ring-[var(--bw-red)]" aria-label={`Open ${a.name}`}>
                          {urls[a.id] ? <img src={urls[a.id]} alt={a.alt} className="aspect-[4/3] w-full bg-white object-cover" /> : <span className="block aspect-[4/3] animate-pulse bg-well" aria-hidden />}
                          <span className="block truncate px-2.5 pt-2 text-[13px] font-semibold text-ink">{a.name}</span>
                          <span className="block truncate px-2.5 text-[11px] text-muted-foreground">{a.width}×{a.height} · {a.mime.replace("image/", "").toUpperCase()} · {humanBytes(a.bytes)}</span>
                          <span className="block px-2.5 pt-0.5 pb-2 text-[10.5px] text-faint">{n ? `used in ${n}` : "not used yet"}{!a.alt && <span className="text-amber"> · no description</span>}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState roomy icon={ImageIcon} title={assets.length ? "No pictures match" : "Your library is empty"} action={!assets.length && <AddPictureButton variant="outline" />}>
                  {assets.length ? "Try another word." : "Bring in a picture from Nextcloud or this computer (or drop files here). You'll crop and shrink it, then Pagesmith can use it."}
                </EmptyState>
              )}
            </div>
          </Panel>
        </GridItem>
        <GridItem span={2}>
          <Panel category="website" title="Where pictures are kept" bodyClassName="grid gap-2 px-3.5 py-3 text-[13px]">
            <p className="text-xs text-muted-foreground">Blackwall doesn't store your pictures: each one is saved as a file in this Nextcloud folder, and the library is the list of them. Change it and new pictures go there; existing ones stay where they are.</p>
            <div className="flex items-center gap-2"><Label htmlFor="assets-folder" className="shrink-0 text-xs font-normal text-muted-foreground">Folder</Label><Input id="assets-folder" className="h-8 font-mono text-xs" value={folder} onChange={(e) => setPrefs({ assetsFolder: e.target.value.startsWith("/") ? e.target.value : `/${e.target.value}` })} /></div>
          </Panel>
        </GridItem>
        <GridItem span={2}>
          <Panel category="website" title="How it fits together" bodyClassName="px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            <ol className="grid list-decimal gap-1 pl-4"><li>Add a picture from Nextcloud or this computer.</li><li>Crop it, set the size and the file type; the saved size is shown as you go.</li><li>In a page or post, choose a picture and it comes from here, with its description.</li><li>When you get the site's files, the pictures it uses are in the <span className="font-mono">images/</span> folder.</li></ol>
          </Panel>
        </GridItem>
      </WorkspaceGrid>
      <Dialog open={!!opened} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-3xl" aria-describedby={undefined}>{opened && <Detail asset={opened} onClose={() => setOpen(null)} />}</DialogContent>
      </Dialog>
    </>
  )
}
