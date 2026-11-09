import { ArrowUp, Folder, ImageIcon, Loader2, Monitor, Plus, Search, Cloud } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { create } from "zustand"
import { assetCloudPath, humanBytes } from "@shared/assets"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { Asset } from "@/lib/types"
import { cn } from "@/lib/utils"
import { fetchFile, isImage, parentOf, storage, type StorageEntry } from "@/features/mikoshi/storage-api"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { AssetEditor, type EditorItem } from "./asset-editor"
import { useAssetUrls, useStorageInfo } from "./use-assets"

/**
 * One place that runs every way of getting a picture into the library or choosing one: pick from Nextcloud or this
 * computer, prepare it, save it; or choose a picture already in the library. Pages call these; the dialogs live in <AssetFlowHost />.
 */
interface FlowState {
  /** Choosing a library picture for somewhere (Pagesmith). */
  chooser: { onPick: (a: Asset) => void } | null
  browsing: boolean
  queue: EditorItem[]
  /** What happens once a prepared picture is saved. */
  after: ((a: Asset) => void) | null
  fileInput: HTMLInputElement | null
  loadingEdit: boolean
}
export const useAssetFlow = create<FlowState>()(() => ({ chooser: null, browsing: false, queue: [], after: null, fileInput: null, loadingEdit: false }))
const set = useAssetFlow.setState

/** Opens the library so one picture can be chosen. */
export const chooseAsset = (onPick: (a: Asset) => void) => set({ chooser: { onPick } })
export const addFromDevice = (after?: (a: Asset) => void) => { set({ after: after ?? null }); useAssetFlow.getState().fileInput?.click() }
export const addFromNextcloud = (after?: (a: Asset) => void) => set({ browsing: true, after: after ?? null })
export const addFiles = (files: File[], after?: (a: Asset) => void) => set({ queue: files.filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(f.name)).map((f) => ({ blob: f, name: f.name, source: `device:${f.name}` })), after: after ?? null })
/** Opens a picture that is already in the library for editing. */
export async function editAsset(a: Asset) {
  set({ loadingEdit: true })
  try {
    const blob = await fetchFile(assetCloudPath(a))
    set({ queue: [{ blob, name: a.file, source: a.source ?? `nextcloud:${assetCloudPath(a)}`, asset: a }], after: null })
  } catch (e) {
    toast.error(`Couldn't open it: ${(e as Error).message}`)
  } finally {
    set({ loadingEdit: false })
  }
}

/** The "Add picture" button: from Nextcloud or from this computer. */
export function AddPictureButton({ after, variant = "default", label = "Add picture" }: { after?: (a: Asset) => void; variant?: "default" | "outline"; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant={variant}><Plus /> {label}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => addFromNextcloud(after)}><Cloud /> From Nextcloud…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => addFromDevice(after)}><Monitor /> From this computer…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Folders and pictures in Nextcloud; choosing a picture opens it in the editor. */
function NextcloudBrowser({ onClose }: { onClose: () => void }) {
  const info = useStorageInfo()
  const [path, setPath] = useState("/")
  const [listing, setListing] = useState<{ path: string; entries?: StorageEntry[]; error?: string } | null>(null)
  const [busy, setBusy] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    let live = true
    storage.list(path).then((l) => live && setListing({ path, entries: l.entries })).catch((e: Error) => live && setListing({ path, error: e.message }))
    return () => { live = false }
  }, [path])
  const entries = listing?.path === path ? listing.entries ?? null : null
  const error = listing?.path === path ? listing.error ?? "" : ""
  const shown = useMemo(() => (entries ?? []).filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase())).filter((e) => e.type === "dir" || isImage(e)).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === "dir" ? -1 : 1)), [entries, q])
  const open = async (e: StorageEntry) => {
    setBusy(e.path)
    try {
      const blob = await fetchFile(e.path)
      set({ queue: [{ blob: new Blob([blob], { type: blob.type || e.mime || "image/jpeg" }), name: e.name, source: `nextcloud:${e.path}` }], browsing: false })
    } catch (err) {
      toast.error(`Couldn't download it: ${(err as Error).message}`)
    } finally {
      setBusy("")
    }
  }
  const crumbs = path.split("/").filter(Boolean)
  if (info && info !== "error" && !info.connected) return <div className="grid gap-3 p-5"><DialogTitle>Nextcloud isn't connected</DialogTitle><DialogDescription>The asset library keeps its pictures in your Nextcloud. Connect it in Settings → Connections first.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => { onClose(); useUi.getState().openSettings("connections") }}>Open connections</Button></div></div>
  return (
    <div className="flex max-h-[80dvh] flex-col">
      <div className="border-b border-line py-3 pr-12 pl-4"><DialogTitle className="font-heading text-base font-bold">Choose a picture from Nextcloud</DialogTitle><DialogDescription className="text-xs text-muted-foreground">Pick one and you'll prepare it before it goes in the library. Your original isn't touched.</DialogDescription></div>
      <div className="flex flex-wrap items-center gap-1 border-b border-line-soft px-3 py-2 text-xs">
        <button type="button" className="rounded px-1.5 py-0.5 text-muted-foreground hover:text-ink" onClick={() => setPath("/")}>Home</button>
        {crumbs.map((c, i) => <span key={i} className="flex items-center gap-1"><span className="text-faint">/</span><button type="button" className="rounded px-1.5 py-0.5 text-ink-2 hover:text-ink" onClick={() => setPath("/" + crumbs.slice(0, i + 1).join("/"))}>{c}</button></span>)}
        <label className="relative ml-auto w-40"><Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-faint" /><Input aria-label="Filter this folder" className="h-7 pl-7 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" /></label>
      </div>
      <ul className="min-h-40 flex-1 overflow-y-auto p-1" aria-label="Nextcloud files">
        {path !== "/" && <li><button type="button" onClick={() => setPath(parentOf(path))} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-raised"><ArrowUp className="size-3.5" /> Up</button></li>}
        {error && <li className="px-3 py-4 text-sm text-red-text">{error}</li>}
        {!entries && !error && <li className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</li>}
        {entries && !shown.length && <li className="px-3 py-4 text-sm text-muted-foreground">No pictures or folders here.</li>}
        {shown.map((e) => (
          <li key={e.path}>
            <button type="button" disabled={!!busy} onClick={() => (e.type === "dir" ? setPath(e.path) : void open(e))} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[13px] hover:bg-raised disabled:opacity-60">
              {e.type === "dir" ? <Folder className="size-4 shrink-0 text-amber" /> : busy === e.path ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ImageIcon className="size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate text-ink">{e.name}</span>{e.type === "file" && <span className="shrink-0 text-[11px] text-faint">{humanBytes(e.size)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A library picture as an image. Shows a calm box while the file arrives. */
export function AssetImage({ asset, className, alt }: { asset: Asset; className?: string; alt?: string }) {
  const urls = useAssetUrls([asset])
  return urls[asset.id] ? <img src={urls[asset.id]} alt={alt ?? asset.alt} className={cn("object-cover", className)} /> : <span className={cn("block animate-pulse bg-well", className)} aria-hidden />
}

/** Choose a picture from the library. This is the only way Pagesmith gets a picture. */
function Chooser({ onPick, onClose }: { onPick: (a: Asset) => void; onClose: () => void }) {
  const assets = useWorkspace((s) => s.assets)
  const [q, setQ] = useState("")
  const urls = useAssetUrls(assets)
  const shown = useMemo(() => [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((a) => !q || `${a.name} ${a.alt} ${(a.tags ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase())), [assets, q])
  return (
    <div className="flex max-h-[85dvh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line py-3 pr-12 pl-4">
        <div className="mr-auto"><DialogTitle className="font-heading text-base font-bold">Choose a picture</DialogTitle><DialogDescription className="text-xs text-muted-foreground">From your asset library.</DialogDescription></div>
        <label className="relative w-44"><Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" /><Input aria-label="Search pictures" className="h-8 pl-7 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" /></label>
        <AddPictureButton variant="outline" label="Add a picture" after={(a) => { onPick(a); onClose() }} />
      </div>
      {shown.length ? (
        <ul className="grid flex-1 grid-cols-2 gap-2.5 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Library pictures">
          {shown.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => { onPick(a); onClose() }} className="group w-full overflow-hidden rounded-[10px] bg-raised text-left ring-1 ring-line-soft transition hover:ring-2 hover:ring-[var(--bw-red)]" aria-label={`Use ${a.name}`}>
                {urls[a.id] ? <img src={urls[a.id]} alt="" className="aspect-[4/3] w-full bg-white object-cover" /> : <span className="block aspect-[4/3] animate-pulse bg-well" aria-hidden />}
                <span className="block truncate px-2 py-1.5 text-xs font-semibold text-ink">{a.name}</span>
                <span className="block truncate px-2 pb-1.5 text-[10.5px] text-faint">{a.width}×{a.height} · {humanBytes(a.bytes)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid place-items-center gap-2 p-10 text-center text-sm text-muted-foreground"><ImageIcon className="size-7" /><p>{assets.length ? "No pictures match." : "Your library is empty. Add a picture and it'll be here to choose."}</p></div>
      )}
    </div>
  )
}

/** Mount once per app shell, next to the record-form host. */
export function AssetFlowHost() {
  const flow = useAssetFlow()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { set({ fileInput: input.current }); return () => set({ fileInput: null }) }, [])
  const current = flow.queue[0]
  const next = () => set((s) => ({ queue: s.queue.slice(1) }))
  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Choose pictures from this computer" data-testid="asset-file-input" onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) addFiles(files, useAssetFlow.getState().after ?? undefined) }} />
      <Dialog open={!!flow.chooser} onOpenChange={(o) => !o && set({ chooser: null })}>
        <DialogContent className="gap-0 p-0 sm:max-w-3xl" aria-describedby={undefined}>{flow.chooser && <Chooser onPick={flow.chooser.onPick} onClose={() => set({ chooser: null })} />}</DialogContent>
      </Dialog>
      <Dialog open={flow.browsing} onOpenChange={(o) => !o && set({ browsing: false })}>
        <DialogContent className="gap-0 p-0 sm:max-w-xl" aria-describedby={undefined}>{flow.browsing && <NextcloudBrowser onClose={() => set({ browsing: false })} />}</DialogContent>
      </Dialog>
      <Dialog open={!!current} onOpenChange={(o) => !o && next()}>
        <DialogContent className="gap-0 p-0 sm:max-w-4xl" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()}>
          {current && <AssetEditor key={`${current.name}:${current.blob.size}`} item={current} onClose={next} onSaved={(a) => { const after = useAssetFlow.getState().after; next(); after?.(a) }} />}
        </DialogContent>
      </Dialog>
      {flow.loadingEdit && <div className="fixed inset-x-0 bottom-6 z-[80] mx-auto flex w-fit items-center gap-2 rounded-full bg-raised px-3 py-1.5 text-xs shadow-lg"><Loader2 className="size-3.5 animate-spin" /> Opening the picture…</div>}
    </>
  )
}
