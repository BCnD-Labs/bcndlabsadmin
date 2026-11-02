import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { downloadWorkspace, resolveWorkspaceConflict, startWorkspaceSync, stopWorkspaceSync, syncWorkspace, useWorkspaceSync } from "@/services/workspace-sync"

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4" role="dialog" aria-modal="true" aria-labelledby="sync-conflict">
      <div className="bw-panel w-full max-w-lg space-y-4 p-5">
        <h2 id="sync-conflict" className="text-base font-semibold">Review workspace changes</h2>
        <p>{message}</p>
        <p className="text-xs text-muted-foreground">{conflicts.length} conflicting records. Changes to other records are merged. Download this device’s copy before choosing; a recovery copy is also kept in Settings.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadWorkspace()}>Download device copy</Button>
          <Button onClick={() => resolveWorkspaceConflict("device")}>Keep device edits</Button>
          <Button variant="outline" onClick={() => resolveWorkspaceConflict("server")}>Keep server edits</Button>
        </div>
      </div>
    </div>
  )
  return (
    <div role="status" className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="workspace-status">
      <span className={`size-1.5 ${status === "saved" ? "bg-green" : "bg-amber"}`} aria-hidden />
      <span>{message}</span>
      {status === "offline" && <><Button size="sm" variant="quiet" onClick={() => void syncWorkspace()}>Retry</Button><Button size="sm" variant="quiet" onClick={() => downloadWorkspace()}>Export unsynced copy</Button></>}
    </div>
  )
}
