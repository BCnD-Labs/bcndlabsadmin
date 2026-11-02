import { create } from "zustand"
import type { InboxItem, InboxStatus } from "@shared/site-inbox"
import { api } from "@/services/connector"

interface InboxState {
  items: InboxItem[]
  loaded: boolean
  checking: boolean
  error?: string
  refresh: () => Promise<void>
  /** Ask the server to collect from the form receiver now instead of waiting for the minute. */
  collect: () => Promise<number>
  setStatus: (ids: string[], status: InboxStatus) => void
  remove: (ids: string[]) => void
}

/** Form messages, comments and newsletter sign-ups the server collected from the form receiver. */
export const useInbox = create<InboxState>()((set, get) => ({
  items: [],
  loaded: false,
  checking: false,
  refresh: async () => {
    try {
      set({ items: (await api<{ items: InboxItem[] }>("inbox")).items, loaded: true, error: undefined })
    } catch (e) {
      set({ loaded: true, error: (e as Error).message })
    }
  },
  collect: async () => {
    set({ checking: true })
    try {
      const r = await api<{ items: InboxItem[]; added: number }>("inbox/collect", { method: "POST" })
      set({ items: r.items, loaded: true, error: undefined })
      return r.added
    } finally {
      set({ checking: false })
    }
  },
  setStatus: (ids, status) => {
    set({ items: get().items.map((i) => (ids.includes(i.id) ? { ...i, status } : i)) })
    void api("inbox", { method: "PATCH", body: JSON.stringify({ ids, status }) }).catch(() => void get().refresh())
  },
  remove: (ids) => {
    set({ items: get().items.filter((i) => !ids.includes(i.id)) })
    void api("inbox", { method: "DELETE", body: JSON.stringify({ ids }) }).catch(() => void get().refresh())
  },
}))
