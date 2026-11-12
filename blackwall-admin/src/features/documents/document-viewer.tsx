import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { documentKind, isLegacyOffice } from "./document-kind"

// Each viewer pulls in its own library, so none of them load until a file of that kind is opened.
const WordView = lazy(() => import("./word-view"))
const SheetView = lazy(() => import("./sheet-view"))
const SlidesView = lazy(() => import("./slides-view"))

/**
 * One Word, Excel or PowerPoint file (.docx, .xlsx, .pptx), drawn in the app and read-only for now.
 * `load` supplies the file's bytes. This is the part of the Docs app that an editor will replace or sit beside later.
 */
export function DocumentPane({ name, load }: { name: string; load: () => Promise<Blob> }) {
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
  if (error) return <div role="alert" className="grid h-full place-items-center rounded-md bg-well p-6 text-center text-sm text-muted-foreground">{error}</div>
  if (!blob) return <p className="p-4 text-sm text-muted-foreground">Opening {name}…</p>
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading the viewer…</p>}>
      {kind === "docx" ? <WordView blob={blob} onError={fail} /> : kind === "xlsx" ? <SheetView blob={blob} onError={fail} /> : <SlidesView blob={blob} onError={fail} />}
    </Suspense>
  )
}
