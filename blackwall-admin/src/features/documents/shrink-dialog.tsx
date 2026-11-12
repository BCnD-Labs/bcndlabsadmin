import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { formatMB } from "./shrink-office"

export type ShrinkChoice = "shrink" | "asis" | "cancel"

/** Asked before uploading large Word, Excel or PowerPoint files: send smaller copies, or send them exactly as they are. */
export function ShrinkDialog({ files, onChoose }: { files: { name: string; size: number }[]; onChoose: (choice: ShrinkChoice) => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onChoose("cancel") }}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>Make {files.length === 1 ? "this file" : `these ${files.length} files`} smaller first?</DialogTitle>
        <DialogDescription>
          Pictures are reduced to at most 1600 pixels on their long side, which still looks sharp on screen. Text, layout and everything else stay exactly the same. The file on your Mac is not changed; only the copy sent to Nextcloud is smaller.
        </DialogDescription>
        <ul className="grid gap-1 text-[13px]">
          {files.slice(0, 6).map((f) => <li key={f.name} className="flex gap-3"><span className="min-w-0 flex-1 truncate text-ink">{f.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{formatMB(f.size)}</span></li>)}
          {files.length > 6 && <li className="text-xs text-faint">and {files.length - 6} more</li>}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onChoose("cancel")}>Cancel</Button>
          <Button variant="outline" onClick={() => onChoose("asis")}>Upload as they are</Button>
          <Button onClick={() => onChoose("shrink")}>Make smaller and upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
