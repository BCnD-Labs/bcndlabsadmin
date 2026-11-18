import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { storage, type EditingInfo } from "@/features/mikoshi/storage-api"
import { cn } from "@/lib/utils"
import { useDocs } from "./docs-store"
import { newDocumentPath } from "./editing"
import { NextcloudPicker } from "./nextcloud-picker"

const KIND: Record<string, string> = { docx: "Word document", xlsx: "Excel workbook", pptx: "PowerPoint", odt: "Text document", ods: "Spreadsheet", odp: "Presentation" }

/** Makes a blank document in Nextcloud and opens it in the editor. Only offered when the office editor is set up. */
export function NewDocumentDialog({ creators, onClose }: { creators: EditingInfo["creators"]; onClose: () => void }) {
  const [extension, setExtension] = useState(creators.find((c) => c.extension === "docx")?.extension ?? creators[0]?.extension ?? "docx")
  const [name, setName] = useState("")
  const [folder, setFolder] = useState("/")
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const path = newDocumentPath(folder, name, extension)
  const create = async () => {
    if (!path) return
    setBusy(true)
    try {
      await storage.editCreate(path, extension)
      const docs = useDocs.getState()
      docs.open(path)
      docs.startEdit(path)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }
  if (choosing) return <NextcloudPicker folders onClose={() => setChoosing(false)} onPick={(p) => { setFolder(p); setChoosing(false) }} />
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>New document</DialogTitle>
        <DialogDescription>A blank file is made in your Nextcloud and opens in the editor.</DialogDescription>
        <div role="radiogroup" aria-label="Kind of document" className="grid grid-cols-2 gap-2">
          {creators.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={c.extension === extension} onClick={() => setExtension(c.extension)} className={cn("rounded-md border px-3 py-2 text-left text-[13px]", c.extension === extension ? "border-line bg-selected text-ink" : "border-line-soft text-muted-foreground hover:text-ink")}>
              {KIND[c.extension] ?? c.name} <span className="text-faint">.{c.extension}</span>
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-[13px] text-muted-foreground">Name
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled" autoFocus onKeyDown={(e) => { if (e.key === "Enter" && path && !busy) void create() }} />
        </label>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Folder</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{folder}</span>
          <Button variant="outline" size="xs" onClick={() => setChoosing(true)}>Change</Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void create()} disabled={!path || busy}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
