import { Check, Download, ExternalLink, FileText, FolderOpen, Pencil, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { downloadFile, fetchFile, parentOf, storage, type EditingInfo, type StorageInfo } from "@/features/mikoshi/storage-api"
import { filesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { DocumentPane } from "./document-viewer"
import { KIND_LABEL, documentKind } from "./document-kind"
import { useDocs, type OpenDoc } from "./docs-store"
import { EditorPane } from "./editor-pane"
import { canEditFile } from "./editing"

function ActiveDocument({ doc, saved }: { doc: OpenDoc; saved: number }) {
  // `saved` changes after editing, so the viewer fetches the file again and shows what was just saved.
  const load = useCallback(() => fetchFile(doc.path) , [doc.path, saved])
  return <DocumentPane key={`${doc.path}:${saved}`} name={doc.name} load={load} />
}

/**
 * Docs: documents from Nextcloud, one tab each. Opening a Word, Excel or PowerPoint file from Files (or from a
 * linked document on a task, note or course) lands here. Opens read-only; Edit switches to Nextcloud's office editor (Collabora)
 * when it is set up, and files the viewer can't draw (older Office and OpenDocument) open straight in the editor.
 */
export function DocsPage() {
  const docs = useDocs((s) => s.docs)
  const active = useDocs((s) => s.active)
  const activate = useDocs((s) => s.activate)
  const close = useDocs((s) => s.close)
  const editingPaths = useDocs((s) => s.editing)
  const saved = useDocs((s) => s.saved)
  const startEdit = useDocs((s) => s.startEdit)
  const stopEdit = useDocs((s) => s.stopEdit)
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [edit, setEdit] = useState<EditingInfo | null>(null)
  useEffect(() => {
    storage.info().then(setInfo).catch(() => undefined)
    storage.editInfo().then(setEdit).catch(() => undefined)
  }, [])
  const doc = docs.find((d) => d.path === active) ?? docs[0]
  const kind = doc ? documentKind(doc.name) : null
  const editable = (d: OpenDoc) => canEditFile(edit, d.name)
  /** In the editor now: asked to, or a file the viewer can't draw that the editor can open. */
  const inEditor = (d: OpenDoc) => editable(d) && (editingPaths.includes(d.path) || !documentKind(d.name))
  const editors = docs.filter(inEditor)
  const showingEditor = !!doc && inEditor(doc)
  const subtitle = doc ? (showingEditor ? "Editing in Nextcloud Office" : kind ? `${KIND_LABEL[kind]} · read-only` : undefined) : undefined
  return (
    <div className="bw-docs-workspace flex h-full min-h-[24rem] flex-col gap-2">
      <PageHeader title="Docs" subtitle={subtitle} actions={<Button variant="outline" size="sm" asChild><Link to={filesHref}><FolderOpen /> Files</Link></Button>} />
      {docs.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-line-soft bg-panel">
          <EmptyState icon={FileText} title="No document open" action={<Button variant="outline" asChild><Link to={filesHref}><FolderOpen /> Browse Files</Link></Button>}>
            Open a Word, Excel or PowerPoint file from Files and it shows here. Documents linked from tasks, notes and courses open here too.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Open documents" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
              {docs.map((d) => {
                const on = d.path === doc?.path
                return (
                  <div key={d.path} className={cn("flex h-8 max-w-56 shrink-0 items-center rounded-[6px] border text-xs", on ? "border-line bg-selected text-ink" : "border-line-soft text-muted-foreground hover:text-ink")}>
                    <button type="button" role="tab" aria-selected={on} title={d.path} onClick={() => activate(d.path)} className="min-w-0 flex-1 truncate px-2.5 text-left">{d.name}</button>
                    <button type="button" aria-label={`Close ${d.name}`} onClick={() => close(d.path)} className="grid size-6 shrink-0 place-items-center rounded-[4px] text-faint hover:bg-raised hover:text-ink"><X className="size-3.5" aria-hidden /></button>
                  </div>
                )
              })}
            </div>
            {doc && editable(doc) && !showingEditor && <Button size="xs" onClick={() => startEdit(doc.path)}><Pencil /> Edit</Button>}
            {doc && showingEditor && !!kind && <Button size="xs" onClick={() => stopEdit(doc.path)}><Check /> Done</Button>}
            {doc && <Button variant="outline" size="xs" onClick={() => void downloadFile({ name: doc.name, path: doc.path, type: "file", size: 0, modified: "" }).catch((e) => toast.error((e as Error).message))}><Download /> Download</Button>}
            {doc && info?.url && <Button asChild variant="outline" size="xs"><a href={`${info.url}/apps/files/?dir=${encodeURIComponent(parentOf(doc.path))}`} target="_blank" rel="noreferrer"><ExternalLink /> Nextcloud</a></Button>}
          </div>
          <div className="relative min-h-0 flex-1">
            {doc && !showingEditor && <div className="h-full" role="tabpanel"><ActiveDocument doc={doc} saved={saved} /></div>}
            {/* Every open editor stays alive (stacked), so switching tabs doesn't reload one mid-edit. */}
            {editors.map((d) => <EditorPane key={d.path} path={d.path} name={d.name} active={showingEditor && d.path === doc?.path} />)}
          </div>
        </>
      )}
    </div>
  )
}
