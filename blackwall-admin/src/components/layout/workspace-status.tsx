import { useEffect } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { downloadWorkspace, downloadConflictServerCopy, workspaceConflictDetails, resolveWorkspaceConflict, startWorkspaceSync, stopWorkspaceSync, syncWorkspace, useWorkspaceSync } from "@/services/workspace-sync"

export function WorkspaceStatus({ connected }: { connected: boolean }) {
  const { status, message, conflicts } = useWorkspaceSync()
  useEffect(() => {
    if (!connected) return
    startWorkspaceSync()
    const refresh = () => { if (document.visibilityState === "visible") void syncWorkspace() }
    const interval = setInterval(refresh, 15_000)
    window.addEventListener("online", refresh)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    const warn = (event: BeforeUnloadEvent) => {
      if (["pending", "offline", "conflict"].includes(useWorkspaceSync.getState().status)) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", warn)
    return () => {
      clearInterval(interval)
      window.removeEventListener("online", refresh)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("beforeunload", warn)
      stopWorkspaceSync()
    }
  }, [connected])
  if (status === "conflict") return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="z-[100] max-h-[90dvh] overflow-y-auto sm:max-w-2xl" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle>Review workspace changes</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
        <p className="text-xs text-muted-foreground">{conflicts.length} conflicting records. Changes to other records are merged. Download this device’s copy before choosing; a recovery copy is also kept in Settings.</p>
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {workspaceConflictDetails().map((item) => <section key={item.id} className="rounded-md border border-line p-3">
            <h3 className="mb-2 break-all text-xs font-semibold">{item.title}</h3>
            {item.fields.map((field) => <div key={field.label} className="mb-3 last:mb-0"><p className="mb-1 text-xs font-medium capitalize">{field.label}</p><div className="grid gap-3 sm:grid-cols-2">{([["This device", field.device], ["Server", field.server]] as const).map(([label, text]) => <div key={label} className="min-w-0"><p className="bw-label">{label}</p><p className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs">{text}</p></div>)}</div></div>)}
          </section>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadWorkspace()}>Download device copy</Button>
          <Button variant="outline" onClick={downloadConflictServerCopy}>Download server copy</Button>
          <Button onClick={() => resolveWorkspaceConflict("device")}>Keep device edits</Button>
          <Button variant="outline" onClick={() => resolveWorkspaceConflict("server")}>Keep server edits</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
  return (
    <div role="status" className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="workspace-status">
      <span className={`size-1.5 ${status === "saved" ? "bg-green" : "bg-amber"}`} aria-hidden />
      <span>{message}</span>
      {status === "offline" && <><Button size="sm" variant="quiet" onClick={() => void syncWorkspace()}>Retry</Button><Button size="sm" variant="quiet" onClick={() => downloadWorkspace()}>Export unsynced copy</Button></>}
    </div>
  )
}
