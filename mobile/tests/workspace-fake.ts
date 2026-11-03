// Test helper: an in-memory server that mimics GET/PUT /api/workspace (see blackwall-admin/server/app.ts),
// plus small record builders and a memory TextStore. Not a test file (tests/*.test.ts only).
import { emptyWorkspace, validWorkspace, type Collections, type WorkspaceSnapshot } from "../src/lib/shared.ts"

export const ADDRESS = "https://blackwall.example.ts.net/"
export const ts = "2026-11-01T00:00:00Z"
export const task = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Task ${id}`, starred: false, done: false, createdAt: ts, updatedAt: ts, ...extra })
export const note = (id: string, text = id) => ({ id, text, pinned: false, color: "plain" as const, createdAt: ts, updatedAt: ts })
export const ws = (extra: Record<string, unknown> = {}): Collections => ({ ...emptyWorkspace(), ...extra })

export interface Call { method: string; url: string; init: RequestInit; body?: { id: string; revision: number; data: Collections } }

export function fakeServer(data: Collections = ws(), revision = 0) {
  const s = {
    snap: { id: "db1", revision, data } as WorkspaceSnapshot,
    signedIn: true,
    down: false,
    /** Runs before each PUT is judged: lets a test play "another device saved first". */
    beforePut: undefined as undefined | ((putNumber: number) => void),
    calls: [] as Call[],
    puts: () => s.calls.filter((c) => c.method === "PUT"),
    /** What another device does: save straight to the server. */
    other(change: (d: Collections) => Collections) {
      s.snap = { ...s.snap, revision: s.snap.revision + 1, data: change(structuredClone(s.snap.data)) }
    },
  }
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET"
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined
    s.calls.push({ method, url, init, body })
    if (s.down) throw new TypeError("Network request failed")
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status })
    if (!s.signedIn) return json(401, { error: "Sign in required" })
    if (method === "GET") return json(200, s.snap)
    s.beforePut?.(s.puts().length)
    if (!body || typeof body.id !== "string" || !Number.isSafeInteger(body.revision) || !validWorkspace(body.data)) return json(400, { error: "Invalid workspace" })
    if (body.id !== s.snap.id || body.revision !== s.snap.revision) return json(409, { error: "Workspace changed on another device." })
    s.snap = { id: body.id, revision: body.revision + 1, data: body.data }
    return json(200, s.snap)
  }) as unknown as typeof fetch
  return Object.assign(s, { fetchImpl })
}

export function memoryStore(initial: string | null = null) {
  const m = { text: initial, writes: 0, read: async () => m.text, write: async (t: string) => { m.text = t; m.writes++ } }
  return m
}
