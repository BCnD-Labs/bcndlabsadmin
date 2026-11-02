import { create } from "zustand"
import { COLLECTION_KEYS, emptyWorkspace, mergeWorkspace, same, validWorkspace, type Collections, type WorkspaceSnapshot } from "@shared/workspace"
import { useWorkspace, WORKSPACE_VERSION, WORKSPACE_STORAGE_KEY } from "@/stores/workspace"
import { safeLocalStorage, storageIsDurable } from "@/stores/storage"
import { api, ConnectorError } from "./connector"

const SYNC_KEY = "blackwall.workspace.sync"
const BACKUP_KEY = "blackwall.workspace.before-server"
interface SyncState {
  ready: boolean
  status: "loading" | "saved" | "pending" | "offline" | "conflict"
  message: string
  conflicts: string[]
}
export const useWorkspaceSync = create<SyncState>()(() => ({ ready: false, status: "loading", message: "Loading shared workspace…", conflicts: [] }))
const pick = (): Collections => Object.fromEntries(COLLECTION_KEYS.map((key) => [key, useWorkspace.getState()[key]])) as unknown as Collections
let active = false
let applying = false
let busy = false
let baseline: WorkspaceSnapshot | undefined
let conflictRemote: WorkspaceSnapshot | undefined
let stopSubscription: (() => void) | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

function saveRecovery(data: Collections) {
  // Preserve the pre-migration / pre-resolution copy, downloadable in Settings.
  safeLocalStorage.setItem(BACKUP_KEY, JSON.stringify({ state: data, version: WORKSPACE_VERSION }))
}
function remember() {
  if (baseline) safeLocalStorage.setItem(SYNC_KEY, JSON.stringify(baseline))
}
function apply(data: Collections) {
  applying = true
  try { useWorkspace.setState(data) } finally { applying = false }
}
function later() {
  clearTimeout(timer)
  timer = setTimeout(() => void syncWorkspace(), 700)
}

/** Start only after authentication; every state change (including Undo/import) joins the outbox. */
export function startWorkspaceSync() {
  if (active) return
  active = true
  generation++
  baseline = undefined
  try {
    const raw = JSON.parse(safeLocalStorage.getItem(SYNC_KEY) as string)
    if (raw && typeof raw.id === "string" && Number.isSafeInteger(raw.revision) && validWorkspace(raw.data)) baseline = raw
  } catch { /* First visit: migrate the versioned browser workspace. */ }
  if (!baseline && COLLECTION_KEYS.some((key) => pick()[key].length)) saveRecovery(pick())
  useWorkspaceSync.setState({ ready: false, status: "loading", message: "Loading shared workspace…", conflicts: [] })
  stopSubscription = useWorkspace.subscribe((state, previous) => {
    if (applying || COLLECTION_KEYS.every((key) => state[key] === previous[key])) return
    if (conflictRemote) return
    useWorkspaceSync.setState({ status: "pending", message: "Changes saved on this device; waiting for server." })
    later()
  })
  void syncWorkspace()
}
export function stopWorkspaceSync() {
  active = false
  generation++
  stopSubscription?.()
  clearTimeout(timer)
  conflictRemote = undefined
  useWorkspaceSync.setState({ ready: false })
}

export async function syncWorkspace() {
  if (!active || busy || conflictRemote) return
  busy = true
  const run = generation
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await api<WorkspaceSnapshot>("workspace", { signal: AbortSignal.timeout(15_000) })
      if (!active || run !== generation) return
      if (!validWorkspace(remote.data)) throw new Error("Server returned an invalid workspace")
      const local = pick()
      // A different database identity means a restore/new installation. Treat both copies as an import.
      const base = baseline?.id === remote.id ? baseline.data : emptyWorkspace()
      const merged = mergeWorkspace(base, local, remote.data)
      if (merged.conflicts.length) {
        conflictRemote = remote
        useWorkspaceSync.setState({ ready: true, status: "conflict", message: "The same records changed on two devices. Choose which edits to keep.", conflicts: merged.conflicts })
        return
      }
      // GET may have overlapped a local edit. Snapshot is captured after it resolves.
      apply(merged.data)
      baseline = remote
      remember()
      useWorkspaceSync.setState({ ready: true })
      if (same(merged.data, remote.data)) {
        useWorkspaceSync.setState({ status: "saved", message: "Saved on server", conflicts: [] })
        return
      }
      try {
        const saved = await api<WorkspaceSnapshot>("workspace", { method: "PUT", signal: AbortSignal.timeout(15_000), body: JSON.stringify({ ...remote, data: merged.data }) })
        if (!active || run !== generation) return
        baseline = saved
        remember()
        // Never replace edits typed while PUT was in flight.
        if (!same(pick(), merged.data)) continue
        useWorkspaceSync.setState({ status: "saved", message: "Saved on server", conflicts: [] })
        return
      } catch (e) {
        if (e instanceof ConnectorError && e.status === 409) continue
        throw e
      }
    }
    useWorkspaceSync.setState({ status: "pending", message: "Other devices are editing. Retrying shortly…" })
    later()
  } catch (e) {
    if (active && run === generation) useWorkspaceSync.setState({ ready: true, status: "offline", message: `${storageIsDurable(WORKSPACE_STORAGE_KEY) ? "Saved on this device only." : "Browser storage unavailable. Keep this tab open or export unsynced edits."} ${(e as Error).message}` })
  } finally {
    busy = false
    // React StrictMode can stop and restart while a request is in flight.
    if (active && run !== generation) later()
  }
}

export function resolveWorkspaceConflict(prefer: "device" | "server") {
  if (!conflictRemote) return
  const local = pick(), remote = conflictRemote
  saveRecovery(local)
  const base = baseline?.id === remote.id ? baseline.data : emptyWorkspace()
  const result = prefer === "device" ? mergeWorkspace(base, local, remote.data) : mergeWorkspace(base, remote.data, local)
  baseline = remote
  remember()
  apply(result.data)
  conflictRemote = undefined
  useWorkspaceSync.setState({ status: "pending", conflicts: [], message: "Saving reviewed changes…" })
  void syncWorkspace()
}

export function downloadWorkspace(data = pick(), name = "workspace") {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ state: data, version: WORKSPACE_VERSION }, null, 2)], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `blackwall-${name}-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
export function downloadMigrationBackup() {
  const raw = safeLocalStorage.getItem(BACKUP_KEY)
  if (typeof raw === "string") downloadWorkspace(JSON.parse(raw).state as Collections, "recovery")
}

export function workspaceConflictDetails() {
  if (!conflictRemote) return []
  const local = pick(), remote = conflictRemote.data
  return useWorkspaceSync.getState().conflicts.map((conflict) => {
    const split = conflict.indexOf(": ")
    const key = conflict.slice(0, split) as keyof Collections, id = conflict.slice(split + 2)
    const ours = local[key].find((row) => row.id === id), theirs = remote[key].find((row) => row.id === id)
    const first = (ours ?? theirs) as unknown as Record<string, unknown> | undefined
    const title = String(first?.title ?? first?.name ?? first?.fullName ?? first?.text ?? id).split("\n")[0]
    const left = ours as unknown as Record<string, unknown> | undefined, right = theirs as unknown as Record<string, unknown> | undefined
    const text = (value: unknown, deleted: boolean) => deleted ? "Record deleted" : value == null ? "Not set" : typeof value === "boolean" ? (value ? "Yes" : "No") : Array.isArray(value) ? value.join(", ") : String(value)
    const fields = [...new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})])]
      .filter((field) => !["id", "createdAt", "updatedAt"].includes(field) && !same(left?.[field], right?.[field]))
      .map((field) => ({ label: field.replace(/([A-Z])/g, " $1"), device: text(left?.[field], !left), server: text(right?.[field], !right) }))
    return { id: conflict, title: `${key} · ${title}`, fields }

  })
}
export function downloadConflictServerCopy() {
  if (conflictRemote) downloadWorkspace(conflictRemote.data, "server-conflict")
}
