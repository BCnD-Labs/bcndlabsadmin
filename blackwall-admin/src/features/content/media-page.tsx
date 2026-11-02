import { Copy, ImageOff, Loader2, RotateCw, Trash2, Upload } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { SiteMediaItem } from "@shared/site"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { NoSignal } from "@/components/common/no-signal"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { cn } from "@/lib/utils"
import { deleteSiteMedia, listSiteMedia, uploadSiteImage, useSite } from "@/services/site"
import { SiteImage } from "./site-image"

const size = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** CMS → Media: the images in your site's images folder. Uploads are committed to the repository. */
export function MediaPage() {
  const site = useSite()
  const live = site.status === "live"
  const [items, setItems] = useState<SiteMediaItem[] | null>(null)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    listSiteMedia()
      .then((m) => (setItems(m), setError(undefined)))
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => {
    if (live) load()
  }, [live, load])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    for (const f of Array.from(files)) {
      try {
        const item = await uploadSiteImage(f)
        setItems((list) => [item, ...(list ?? []).filter((x) => x.path !== item.path)])
        toast.success(`Uploaded ${item.name}`)
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`)
      }
    }
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title="Media"
        badge={<SourceBadge status={site.status} />}
        actions={
          live && (
            <>
              <Button variant="ghost" onClick={load}><RotateCw /> Reload</Button>
              <Button onClick={() => ref.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload
              </Button>
              <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = "" }} />
            </>
          )
        }
      />
      {!live ? (
        <Panel tool="media" command="ls" className="max-w-3xl">
          {site.status === "loading" ? (
            <p className="px-3.5 py-3 text-xs text-muted-foreground">Checking your website…</p>
          ) : (
            <NoSignal badge={false} message="Connect your website to see and upload the images it uses." add="website" action="Connect website" />
          )}
        </Panel>
      ) : error ? (
        <Panel tool="media" command="ls" className="max-w-3xl">
          <p className="px-3.5 py-3 text-xs text-red-text">Couldn't list images: {error}</p>
        </Panel>
      ) : !items ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : items.length ? (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          aria-label="Images"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void upload(e.dataTransfer.files)
          }}
        >
          {items.map((m) => (
            <li key={m.path} className={cn("group flex flex-col overflow-hidden rounded-[10px] border border-line bg-raised", confirm === m.path && "border-red/60")}>
              <SiteImage path={m.path} siteUrl={site.overview?.siteUrl} alt={m.name} className="aspect-square w-full border-b border-line" />
              <div className="flex items-center gap-1 px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink" title={m.name}>{m.name}</span>
                  <span className="block text-[10px] text-faint">{size(m.size)}</span>
                </span>
                {confirm === m.path ? (
                  <>
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={async () => {
                        try {
                          await deleteSiteMedia(m.path)
                          setItems((l) => (l ?? []).filter((x) => x.path !== m.path))
                          toast("Image removed from the site")
                        } catch (e) {
                          toast.error((e as Error).message)
                        }
                        setConfirm(null)
                      }}
                    >
                      Delete
                    </Button>
                    <Button variant="quiet" size="icon-xs" aria-label="Keep" onClick={() => setConfirm(null)}>✕</Button>
                  </>
                ) : (
                  <>
                    <Button variant="quiet" size="icon-xs" aria-label={`Copy Markdown for ${m.name}`} title="Copy Markdown" onClick={() => navigator.clipboard.writeText(`![](${m.path})`).then(() => toast.success("Markdown copied"))}>
                      <Copy />
                    </Button>
                    <Button variant="quiet" size="icon-xs" aria-label={`Delete ${m.name}`} title="Delete" onClick={() => setConfirm(m.path)}>
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Panel tool="media" command="ls" className="max-w-3xl">
          <EmptyState icon={ImageOff} title="No images yet" action={<Button variant="outline" onClick={() => ref.current?.click()}><Upload /> Upload</Button>}>
            Images you upload here, or as post covers, are added to your site's images folder.
          </EmptyState>
        </Panel>
      )}
    </>
  )
}
