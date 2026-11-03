import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AppState } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { createWorkspaceClient, type Key, type WorkspaceClient } from "../../lib/workspace-client.ts"
import { createWorkspaceFileStore } from "../../lib/workspace-file-store.ts"
import { pollDelay, type SyncStatus } from "./sync-view.ts"

export interface ConflictInfo { conflicts: string[]; mine: Collections; theirs: Collections }

export interface WorkspaceValue {
  /** What this phone shows: the server's data plus unsent edits. Null until something is loaded or cached. */
  data: Collections | null
  status: SyncStatus
  /** True while edits are saving or waiting to be sent. */
  pending: boolean
  /** How many records those edits touch. */
  pendingCount: number
  /** Why the status is not "ok" (fixed short text from the client), or why the last change was refused. */
  message?: string
  /** True while a pull-to-refresh is running. */
  refreshing: boolean
  conflict: ConflictInfo | null
  refresh: () => Promise<void>
  /** Applies a shared record rule to the workspace and saves it. `keys` must list every collection `fn` changes. */
  mutate: (keys: readonly Key[], fn: (data: Collections) => Collections) => Promise<void>
  resolveConflict: (choice: "mine" | "theirs") => Promise<void>
}

const Context = createContext<WorkspaceValue | null>(null)

type View = Pick<WorkspaceValue, "data" | "status" | "pending" | "pendingCount" | "message" | "conflict">

function readView(client: WorkspaceClient): View {
  const s = client.getState()
  return {
    data: s.snapshot?.data ?? null,
    status: s.status === "idle" ? "loading" : s.status,
    pending: s.pending,
    pendingCount: client.pendingCount(),
    message: s.lastError,
    conflict: s.status === "conflict" ? (client.getConflict() ?? null) : null,
  }
}

/**
 * One workspace client for the native app, created from the saved server address. It loads on
 * mount, again whenever the app returns to the foreground, and polls while the app is in the
 * foreground (see pollDelay). Every screen reads and saves through `useWorkspace()`.
 */
export function WorkspaceProvider({ address, children }: { address: string; children: ReactNode }) {
  const client = useMemo(() => createWorkspaceClient({ address, store: createWorkspaceFileStore() }), [address])
  const [view, setView] = useState<View>(() => readView(client))
  const [notice, setNotice] = useState<string>()
  const [refreshing, setRefreshing] = useState(false)
  const loading = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    setView(readView(client))
    const off = client.subscribe(() => alive.current && setView(readView(client)))
    return () => {
      alive.current = false
      off()
    }
  }, [client])

  /** One quiet load; a load already in flight is not doubled up. */
  const load = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    try {
      await client.load()
      if (alive.current) setNotice(undefined)
    } catch {
      /* the client reports problems through its state */
    } finally {
      loading.current = false
    }
  }, [client])

  useEffect(() => {
    void load()
    const sub = AppState.addEventListener("change", (next) => next === "active" && void load())
    return () => sub.remove()
  }, [load])

  // Polls while the app is in the foreground. A self-rescheduling timer, so it keeps going when a
  // poll changes nothing (offline, same data) and the delay follows the latest status.
  const statusRef = useRef(view.status)
  statusRef.current = view.status
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (AppState.currentState === "active") await load()
      if (!stopped) timer = setTimeout(tick, pollDelay(statusRef.current))
    }
    timer = setTimeout(tick, pollDelay(statusRef.current))
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      if (alive.current) setRefreshing(false)
    }
  }, [load])

  const mutate = useCallback<WorkspaceValue["mutate"]>(
    async (keys, fn) => {
      try {
        await client.mutate(keys, fn)
        if (alive.current) setNotice(undefined)
      } catch (error) {
        if (alive.current) setNotice(error instanceof Error ? error.message : "That change couldn't be saved.")
      }
    },
    [client],
  )

  const resolveConflict = useCallback(
    async (choice: "mine" | "theirs") => {
      try {
        await client.resolveConflict(choice)
      } catch {
        /* the client reports problems through its state */
      }
    },
    [client],
  )

  const value = useMemo<WorkspaceValue>(
    () => ({ ...view, message: notice ?? view.message, refreshing, refresh, mutate, resolveConflict }),
    [view, notice, refreshing, refresh, mutate, resolveConflict],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(Context)
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.")
  return value
}
