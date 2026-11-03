import { useWorkspaceSync } from "@/services/workspace-sync"

/** Reuse the actual outbox/server status; never claim a local draft is saved remotely. */
export function PlannerSaveState() {
  const status = useWorkspaceSync((state) => state.status)
  return <span className="text-[11px] text-muted-foreground" aria-live="polite">{{
    loading: "Loading…", saved: "Saved", pending: "Saving…", offline: "Saved on device · offline", conflict: "Save needs review",
  }[status]}</span>
}
