import { Download, ExternalLink } from "lucide-react"
import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { KIND_LABEL, documentKind, isLegacyOffice } from "./document-kind"

// Each viewer pulls in its own library, so none of them load until a file of that kind is opened.
const WordView = lazy(() => import("./word-view"))
const SheetView = lazy(() => import("./sheet-view"))
const SlidesView = lazy(() => import("./slides-view"))

/**
 * A read-only viewer for Word, Excel and PowerPoint files (the .docx, .xlsx and .pptx formats), drawn in the app:
 * no Office, no upload to a third party. `load` supplies the file's bytes; the file itself is never changed.
 */
export function DocumentViewer({ name, load, onClose, onDownload, nextcloudUrl }: { name: string; load: () => Promise<Blob>; onClose: () => void; onDownload?: () => void; nextcloudUrl?: string }) {
  const kind = documentKind(name)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(kind ? null : isLegacyOffice(name) ? "Older Office and OpenDocument files can't be shown here yet. Download it, or open it in Nextcloud." : "This kind of file can't be shown here.")
  useEffect(() => {
    if (!kind) return
    let alive = true
    load().then((b) => alive && setBlob(b)).catch((e) => alive && setError((e as Error).message))
    return () => { alive = false }
  }, [kind, load])
  const fail = useCallback((message: string) => setError(message), [])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[88dvh] flex-col gap-2 p-3 sm:max-w-[min(1240px,94vw)]">
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm">{name}</DialogTitle>
          {kind && <span className="shrink-0 text-[11px] text-muted-foreground">{KIND_LABEL[kind]} · read-only</span>}
          {onDownload && <Button variant="outline" size="xs" onClick={onDownload}><Download /> Download</Button>}
          {nextcloudUrl && <Button asChild variant="outline" size="xs"><a href={nextcloudUrl} target="_blank" rel="noreferrer"><ExternalLink /> Nextcloud</a></Button>}
        </div>
        <DialogDescription className="sr-only">Read-only preview of {name}</DialogDescription>
        <div className="min-h-0 flex-1">
          {error ? (
            <div role="alert" className="grid h-full place-items-center rounded-md bg-well p-6 text-center text-sm text-muted-foreground">{error}</div>
          ) : !blob ? (
            <p className="p-4 text-sm text-muted-foreground">Opening {name}…</p>
          ) : (
            <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading the viewer…</p>}>
              {kind === "docx" ? <WordView blob={blob} onError={fail} /> : kind === "xlsx" ? <SheetView blob={blob} onError={fail} /> : <SlidesView blob={blob} onError={fail} />}
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
