import { usePrefs } from "@/stores/prefs"
import { create } from "zustand"
import type { ConnectionInput, ProviderId, PublicConnection } from "@shared/connections"

/**
 * Client for the local connector (server/plugin.ts). The connector holds
 * credentials and calls external services; the browser only sees redacted
 * connection records and the data it asks for.
 */
export class ConnectorError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Blackwall": "1", ...init.headers },
    })
  } catch {
    throw new ConnectorError("The local connector isn't reachable", 0)
  }
  if (res.status === 204) return undefined as T
  if (res.status === 401 && !path.startsWith("login")) useSession.getState().expired()
  const type = res.headers.get("content-type") ?? ""
  if (!type.includes("application/json")) throw new ConnectorError("The local connector isn't running", 0)
  const body = await res.json()
  if (!res.ok) throw new ConnectorError(body.error ?? `HTTP ${res.status}`, res.status)
  return body as T
}

/**
 * Sign-in state. On the home server the API requires a password; the local
 * dev connector doesn't. "offline" means no API at all (e.g. a static build),
 * in which case the panel still works with its local data.
 */
interface SessionState {
  state: "checking" | "open" | "signin" | "offline"
  authRequired: boolean
  check: () => Promise<void>
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
  expired: () => void
}

export const useSession = create<SessionState>()((set) => ({
  state: "checking",
  authRequired: false,
  check: async () => {
    try {
      const s = await api<{ authRequired: boolean; authenticated: boolean }>("session")
      set({ authRequired: s.authRequired, state: s.authenticated ? "open" : "signin" })
    } catch {
      set({ state: "offline", authRequired: false })
    }
  },
  login: async (password) => {
    await api("login", { method: "POST", body: JSON.stringify({ password }) })
    set({ state: "open" })
  },
  logout: async () => {
    await api("logout", { method: "POST" })
    set({ state: "signin" })
  },
  expired: () => set((s) => (s.authRequired ? { state: "signin" } : s)),
}))

interface ConnectionsState {
  /** null until the first load finishes */
  available: boolean | null
  list: PublicConnection[]
  busy: Record<string, boolean>
  refresh: () => Promise<void>
  create: (input: ConnectionInput) => Promise<PublicConnection>
  update: (id: string, input: Partial<ConnectionInput>) => Promise<PublicConnection>
  test: (id: string) => Promise<PublicConnection>
  remove: (id: string) => Promise<void>
}

const replace = (list: PublicConnection[], c: PublicConnection) =>
  list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]

export const useConnections = create<ConnectionsState>()((set, get) => {
  const busy = async <T>(id: string, fn: () => Promise<T>) => {
    set((s) => ({ busy: { ...s.busy, [id]: true } }))
    try {
      return await fn()
    } finally {
      set((s) => ({ busy: { ...s.busy, [id]: false } }))
    }
  }
  return {
    available: null,
    list: [],
    busy: {},
    refresh: async () => {
      try {
        set({ list: await api<PublicConnection[]>("connections"), available: true })
      } catch {
        set({ available: false, list: [] })
      }
    },
    create: (input) =>
      busy("new", async () => {
        const c = await api<PublicConnection>("connections", { method: "POST", body: JSON.stringify(input) })
        set({ list: replace(get().list, c) })
        return c
      }),
    update: (id, input) =>
      busy(id, async () => {
        const c = await api<PublicConnection>(`connections/${id}`, { method: "PUT", body: JSON.stringify(input) })
        set({ list: replace(get().list, c) })
        return c
      }),
    test: (id) =>
      busy(id, async () => {
        const c = await api<PublicConnection>(`connections/${id}/test`, { method: "POST" })
        set({ list: replace(get().list, c) })
        return c
      }),
    remove: (id) =>
      busy(id, async () => {
        await api(`connections/${id}`, { method: "DELETE" })
        set({ list: get().list.filter((c) => c.id !== id) })
      }),
  }
})

/** The connection a data panel should use for a provider, if any. */
export function useConnectionFor(provider: ProviderId) {
  const selected = usePrefs((s) => provider === "github" || provider === "analytics" ? s.feedConnections[provider] : undefined)
  const list = useConnections((s) => s.list)
  const all = list.filter((c) => c.provider === provider)
  return selected ? all.find((c) => c.id === selected) : all.find((c) => c.status === "ok") ?? all[0]
}
