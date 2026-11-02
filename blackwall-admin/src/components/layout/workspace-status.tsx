import { useEffect } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CircleCheck, CircleX, Download, LoaderCircle, RotateCw } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
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
  return null
}

/**
 * Save status as one small icon (the rail, above Settings): a check when saved, a
 * pulsing dot while saving, a cross when offline. Click for details and, offline,
 * Retry or Export.
 */
export function SyncStatus({ expanded = false }: { expanded?: boolean }) {
  const { status, message } = useWorkspaceSync()
  const tone = status === "saved" ? "text-green" : status === "offline" ? "text-red-light" : "text-amber"
  const Icon = status === "saved" ? CircleCheck : status === "offline" ? CircleX : LoaderCircle
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Workspace: ${message}`}
          title={message}
          data-testid="workspace-status"
          data-status={status}
          className={cn(
            "flex shrink-0 items-center rounded-[10px] text-[12px] text-muted-foreground hover:bg-raised hover:text-ink-2",
            expanded ? "h-8 w-full gap-3 px-2.5" : "size-[var(--bw-nav-item)] justify-center",
          )}
        >
          <Icon className={cn("size-4 shrink-0", tone, status === "pending" && "animate-spin motion-reduce:animate-none")} strokeWidth={2} aria-hidden />
          {expanded && <span className="min-w-0 flex-1 truncate text-left">{message}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-60">
        <DropdownMenuLabel className="bw-label">Workspace</DropdownMenuLabel>
        <p className="px-2 pb-1.5 text-xs text-ink-2">{message}</p>
        <DropdownMenuItem onSelect={() => void syncWorkspace()}><RotateCw /> Sync now</DropdownMenuItem>
        {status === "offline" && <DropdownMenuItem onSelect={() => downloadWorkspace()}><Download /> Export unsynced copy</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
