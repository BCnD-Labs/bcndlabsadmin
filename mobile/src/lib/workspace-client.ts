/**
 * The app's one way to read and write the shared workspace (the same data the web app edits).
 * Pure TypeScript: no React, no Expo. The network (`fetchImpl`) and the on-phone cache (`store`)
 * are injected, so everything here runs under `node --test`.
 *
 * Rules it never breaks (they mirror blackwall-admin/src/services/workspace-sync.ts):
 * - every save is `PUT {id, revision, data}`; a stale revision (409) is never forced through.
 *   The client re-reads, runs the shared three-way `mergeWorkspace(base, local, remote)` and
 *   retries, at most MAX_RETRIES times after the first attempt.
 * - the same record edited on two devices is a conflict: nothing is written until the person
 *   picks a side with `resolveConflict`, and the side not picked is kept as a recovery copy.
 * - an edit made offline is applied locally, saved in the cache as `pending` and sent later by
 *   `flush()` (or by the next `load()`) through the same merge path.
 * - before anything is sent, collections the edit did not declare must be unchanged and the
 *   whole workspace must still pass `validWorkspace`.
 */
import { COLLECTION_KEYS, emptyWorkspace, mergeWorkspace, same, validWorkspace, type Collections, type WorkspaceSnapshot } from "./shared.ts"
import { parseCache, serializeCache } from "./workspace-cache.ts"
import { countUnsent } from "./workspace-diff.ts"
import { MAX_BODY_CHARS, requestWorkspace, type Outcome } from "./workspace-http.ts"

/** The cache file: one text in, one text out. Implementations must never throw. */
export interface TextStore {
  read(): Promise<string | null>
  write(text: string): Promise<void>
}
export type Key = keyof Collections
export type Status = "ok" | "offline" | "signed-out" | "error" | "conflict"
export interface ClientState { status: Status | "idle"; snapshot?: WorkspaceSnapshot; pending: boolean; lastError?: string }
/** `ok` with `pending: false` = saved on the server. Any other status: `snapshot` is still what this phone has. */
export interface Result { status: Status; pending: boolean; snapshot?: WorkspaceSnapshot; message?: string; mine?: Collections; theirs?: Collections; conflicts?: string[] }

/** Retries after the first save attempt (the web app makes 4 attempts in all; this is 1 + 4). */
export const MAX_RETRIES = 4
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function createWorkspaceClient(opts: { address: string; fetchImpl?: typeof fetch; store?: TextStore }) {
  const fetchImpl = opts.fetchImpl ?? fetch
  let baseline: WorkspaceSnapshot | undefined // last snapshot the server confirmed
  let local: Collections | undefined // what this phone shows: baseline plus unsent edits
  let dirty = false // local has edits the server has not accepted
  let touched = new Set<Key>() // collections those unsent edits declared
  let recovery: Collections | undefined
  let conflict: { remote: WorkspaceSnapshot; conflicts: string[] } | undefined
  let hydrating: Promise<void> | undefined
  let chain: Promise<unknown> = Promise.resolve()
  let state: ClientState = { status: "idle", pending: false }
  const listeners = new Set<() => void>()

  const snapshot = (): WorkspaceSnapshot | undefined => (baseline && local ? { id: baseline.id, revision: baseline.revision, data: local } : undefined)
  function setState(patch: Partial<ClientState>) {
    state = { ...state, snapshot: snapshot(), pending: dirty, ...patch }
    listeners.forEach((listener) => listener())
  }
  async function persist() {
    if (!baseline) return
    try {
      await opts.store?.write(serializeCache({ baseline, local: dirty ? local : undefined, touched: dirty ? [...touched] : undefined, recovery }))
    } catch {
      /* A cache that can't be written degrades to "no cache"; the server copy is the truth. */
    }
  }
  const hydrate = () => (hydrating ??= (async () => {
    try {
      const cache = parseCache(await opts.store?.read())
      if (cache) {
        baseline = cache.baseline
        local = cache.local ?? cache.baseline.data
        dirty = !!cache.local && !same(cache.local, cache.baseline.data)
        touched = new Set(cache.touched ?? COLLECTION_KEYS.filter((key) => !same(local![key], baseline!.data[key])))
        recovery = cache.recovery
      }
    } catch {
      /* no cache */
    }
    setState({})
  })())
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const run = chain.then(job)
    chain = run.catch(() => undefined)
    return run
  }

  function result(status: Status, message?: string): Result {
    setState({ status, lastError: status === "ok" ? undefined : message })
    const base: Result = { status, pending: dirty, snapshot: snapshot(), message }
    return status === "conflict" && conflict && local ? { ...base, mine: local, theirs: conflict.remote.data, conflicts: conflict.conflicts } : base
  }
  async function settled(status: Status, message?: string): Promise<Result> {
    await persist()
    return result(status, message)
  }
  /** Nothing to send: report where things stand without claiming anything new. */
  const current = (): Result => (!baseline ? result("error", "The workspace isn't loaded yet.") : result(state.status === "idle" ? "ok" : state.status, state.lastError))
  const failure = (out: Outcome): Promise<Result> =>
    out.kind === "offline" ? settled("offline", "Can't reach the server. Changes are kept on this phone and will sync later.")
    : out.kind === "signed-out" ? settled("signed-out", "Signed out. Sign in again; changes are kept on this phone.")
    : settled("error", out.kind === "error" ? out.message : "The server changed while saving. Try again.")

  /** Three-way merge of the server's newest snapshot into the local copy. Returns a Result only on conflict. */
  function absorb(remote: WorkspaceSnapshot): Result | undefined {
    const sameDb = baseline?.id === remote.id
    // A different database id means a restore or a new install: treat both copies as an import (like the web).
    const base = sameDb && baseline ? baseline.data : emptyWorkspace()
    if (!sameDb) COLLECTION_KEYS.forEach((key) => touched.add(key))
    const merged = mergeWorkspace(base, local!, remote.data)
    if (merged.conflicts.length) {
      conflict = { remote, conflicts: merged.conflicts }
      return result("conflict", "The same records changed on two devices. Choose which edits to keep.")
    }
    // Collections this phone never edited are exactly the server's (keeps the server's order).
    for (const key of COLLECTION_KEYS) if (!touched.has(key) && same(local![key], base[key])) Object.assign(merged.data, { [key]: remote.data[key] })
    baseline = remote
    local = merged.data
    dirty = !same(local, remote.data)
    if (!dirty) touched.clear()
    return undefined
  }

  /** Sends unsent edits: PUT, and on 409 re-read, merge and retry. `remote` = a snapshot already fetched. */
  async function sync(remote?: WorkspaceSnapshot): Promise<Result> {
    if (!baseline || !local) return result("error", "The workspace isn't loaded yet.")
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (remote) {
        const conflicted = absorb(remote)
        remote = undefined
        if (conflicted) return conflicted
      }
      if (!dirty) return settled("ok")
      const unexpected = COLLECTION_KEYS.find((key) => !touched.has(key) && !same(local![key], baseline!.data[key]))
      if (unexpected) return settled("error", `Refusing to save: ${unexpected} changed without being part of an edit.`)
      if (!validWorkspace(local)) return settled("error", "Refusing to save: the data is no longer valid.")
      const sent = local
      const out = await requestWorkspace(opts.address, fetchImpl, { id: baseline.id, revision: baseline.revision, data: sent })
      if (out.kind === "ok") {
        baseline = out.snapshot
        dirty = local !== sent // an edit made while the save was in flight still has to go out
        if (!dirty) touched.clear()
        continue
      }
      if (out.kind !== "stale") return failure(out)
      const fresh = await requestWorkspace(opts.address, fetchImpl)
      if (fresh.kind !== "ok") return failure(fresh)
      remote = fresh.snapshot
    }
    return settled("error", "Other devices are editing. Your change is kept on this phone; try again shortly.")
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },

    /** Reads the server's workspace (merging any unsent edits first); offline falls back to the cache. */
    load: (): Promise<Result> => enqueue(async () => {
      await hydrate()
      if (conflict) return result("conflict", "Choose which edits to keep before loading again.")
      const out = await requestWorkspace(opts.address, fetchImpl)
      if (out.kind !== "ok") return failure(out)
      if (baseline && local && dirty) return sync(out.snapshot)
      baseline = out.snapshot
      local = out.snapshot.data
      touched.clear()
      return settled("ok")
    }),

    /** Applies `fn` to the latest local data (it gets a copy), declaring which collections it changes, and saves. */
    async mutate(keys: readonly Key[], fn: (data: Collections) => Collections): Promise<Result> {
      await hydrate()
      if (!local || !baseline) throw new Error("The workspace isn't loaded yet.")
      if (conflict) return result("conflict", "Choose which edits to keep first.")
      const before = local
      const next = fn(clone(before))
      if (!next || typeof next !== "object") throw new Error("That change didn't produce a workspace, so it wasn't saved.")
      const stray = COLLECTION_KEYS.find((key) => !keys.includes(key) && !same(next[key], before[key]))
      if (stray) throw new Error(`Refusing to change ${stray}: the edit didn't declare it.`)
      if (!validWorkspace(next)) throw new Error("That change isn't valid, so it wasn't saved.")
      if (JSON.stringify(next).length > MAX_BODY_CHARS) throw new Error("The workspace would be too large to save.")
      if (!same(next, before)) {
        local = next
        dirty = true
        keys.forEach((key) => touched.add(key))
        setState({})
        await persist()
      }
      return enqueue(async () => (dirty ? sync() : current()))
    },

    /** Retries unsent edits now (same merge path as a normal save). */
    flush: (): Promise<Result> => enqueue(async () => {
      await hydrate()
      if (conflict) return result("conflict", "Choose which edits to keep first.")
      return dirty ? sync() : current()
    }),

    /** Settles a conflict: "mine" keeps this phone's version of the clashing records, "theirs" the server's. */
    resolveConflict: (choice: "mine" | "theirs"): Promise<Result> => enqueue(async () => {
      if (!conflict || !baseline || !local) return current()
      const remote = conflict.remote
      const base = baseline.id === remote.id ? baseline.data : emptyWorkspace()
      recovery = choice === "mine" ? remote.data : local // never throw the other side away
      const merged = choice === "mine" ? mergeWorkspace(base, local, remote.data) : mergeWorkspace(base, remote.data, local)
      conflict = undefined
      baseline = remote
      local = merged.data
      dirty = !same(local, remote.data)
      touched = new Set(COLLECTION_KEYS.filter((key) => !same(local![key], remote.data[key])))
      await persist()
      return sync()
    }),

    /** How many records have unsent edits (0 when everything is saved). */
    pendingCount: () => (dirty && baseline && local ? countUnsent(baseline.data, local, touched) : 0),
    getConflict: () => (conflict && local ? { mine: local, theirs: conflict.remote.data, conflicts: conflict.conflicts } : undefined),
    /** The side discarded by the last conflict choice, if any. */
    getRecovery: () => recovery,
  }
}

export type WorkspaceClient = ReturnType<typeof createWorkspaceClient>
