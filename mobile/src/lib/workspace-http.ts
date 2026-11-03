/**
 * The two workspace requests, nothing else: `GET /api/workspace` and `PUT /api/workspace`
 * (body `{id, revision, data}`). Same contract as blackwall-admin/server/app.ts: every request
 * carries `X-Blackwall: 1`, `credentials: "include"` lets Android's shared cookie store supply
 * the sign-in cookie, 401 = signed out, 409 = the revision is stale.
 *
 * Pure apart from the injected fetch. Messages are fixed short strings: no address, cookie,
 * header or response body is ever copied into them.
 */
import { COLLECTION_KEYS, validWorkspace, type WorkspaceSnapshot } from "./shared.ts"

export const WORKSPACE_TIMEOUT_MS = 15_000
/** The server refuses bodies over 16 MB; stay a little under so a refusal is never the first sign. */
export const MAX_BODY_CHARS = 15_500_000

export type Outcome =
  | { kind: "ok"; snapshot: WorkspaceSnapshot }
  | { kind: "offline" }
  | { kind: "signed-out" }
  | { kind: "stale" }
  | { kind: "error"; message: string }

export function workspaceUrl(address: string): string {
  return `${address.replace(/\/+$/, "")}/api/workspace`
}

/** A snapshot the app can trust, or null: `{id, revision, data}` with a valid workspace inside. */
export function parseSnapshot(value: unknown): WorkspaceSnapshot | null {
  if (!value || typeof value !== "object") return null
  const v = value as { id?: unknown; revision?: unknown; data?: unknown }
  if (typeof v.id !== "string" || !v.id || typeof v.revision !== "number" || !Number.isSafeInteger(v.revision) || v.revision < 0) return null
  if (!validWorkspace(v.data)) return null
  return { id: v.id, revision: v.revision, data: v.data }
}

export const isCollectionKey = (key: unknown): key is (typeof COLLECTION_KEYS)[number] => (COLLECTION_KEYS as readonly unknown[]).includes(key)

const BAD_BODY = "The server's workspace wasn't in a form the app understands."

/** One request with a timeout. `put` makes it a save; otherwise it is a read. */
export async function requestWorkspace(address: string, fetchImpl: typeof fetch, put?: WorkspaceSnapshot): Promise<Outcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WORKSPACE_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetchImpl(workspaceUrl(address), {
        method: put ? "PUT" : "GET",
        body: put ? JSON.stringify({ id: put.id, revision: put.revision, data: put.data }) : undefined,
        signal: controller.signal,
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-Blackwall": "1" },
      })
    } catch {
      return { kind: "offline" }
    }
    if (res.status === 401) return { kind: "signed-out" }
    if (res.status === 409 && put) return { kind: "stale" }
    if (res.status === 502 || res.status === 503 || res.status === 504) return { kind: "offline" }
    if (res.status === 403) return { kind: "error", message: "The server refused the request. Check the address under Server." }
    if (!res.ok) return { kind: "error", message: `The server answered ${res.status}.` }
    try {
      const snapshot = parseSnapshot(await res.json())
      return snapshot ? { kind: "ok", snapshot } : { kind: "error", message: BAD_BODY }
    } catch {
      return controller.signal.aborted ? { kind: "offline" } : { kind: "error", message: BAD_BODY }
    }
  } finally {
    clearTimeout(timer)
  }
}
