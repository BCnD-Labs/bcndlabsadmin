import { ChevronRight, File, Folder } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { parentOf, storage, type FolderListing } from "@/features/mikoshi/storage-api"

/**
 * Browse your Nextcloud and pick one file to link. Folders open; the file you click is chosen.
 * With `folders`, only folders show and "Use this folder" picks the one you are in.
 */
export function NextcloudPicker({ onPick, onClose, folders = false }: { onPick: (path: string, name: string) => void; onClose: () => void; folders?: boolean }) {
  const [dir, setDir] = useState("/")
  const [listing, setListing] = useState<FolderListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    storage.list(dir).then((l) => { if (alive) { setListing(l); setError(null) } }).catch((e) => alive && setError((e as Error).message))
    return () => { alive = false }
  }, [dir])
  const entries = [...(listing?.entries ?? [])].filter((e) => !folders || e.type === "dir").sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>{folders ? "Choose a folder" : "Link a Nextcloud file"}</DialogTitle>
        <DialogDescription className="truncate font-mono text-xs">{dir}</DialogDescription>
        <div className="max-h-[50dvh] overflow-y-auto rounded-md border border-line-soft">
          {dir !== "/" && <button type="button" onClick={() => setDir(parentOf(dir))} className="flex w-full items-center gap-2 border-b border-line-soft px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-raised"><Folder className="size-4" aria-hidden /> ..</button>}
          {error ? <p role="alert" className="p-3 text-sm text-red-text">{error}</p> : !listing ? <p className="p-3 text-sm text-muted-foreground">Loading…</p> : entries.length === 0 ? <p className="p-3 text-sm text-muted-foreground">This folder is empty.</p> : entries.map((e) => (
            <button key={e.path} type="button" onClick={() => (e.type === "dir" ? setDir(e.path) : onPick(e.path, e.name))} className="flex w-full items-center gap-2 border-b border-line-soft px-3 py-2 text-left text-[13px] text-ink last:border-b-0 hover:bg-raised">
              {e.type === "dir" ? <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              {e.type === "dir" && <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {folders && <Button onClick={() => onPick(dir, dir.split("/").filter(Boolean).pop() ?? "/")}>Use this folder</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
