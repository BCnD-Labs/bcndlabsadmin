import { create } from "zustand"
import type { FeedItem, NotifyGroup } from "@shared/notifications"
import { api } from "@/services/connector"

export type NotificationKind = NotifyGroup
export type BwNotification = FeedItem

interface NotificationState {
  items: BwNotification[]
  /** False until the server answered once (the bell then shows "no notifications" vs. loading). */
  loaded: boolean
  error?: string
  refresh: () => Promise<void>
  markRead: (id: string) => void
  markManyRead: (ids: string[]) => void
  markAllRead: () => void
}

/**
 * The bell's feed, kept by the Blackwall server (which also pushes to ntfy and email per
 * Settings → Notifications). Refreshed every minute while signed in.
 */
export const useNotifications = create<NotificationState>()((set, get) => ({
  items: [],
  loaded: false,
  refresh: async () => {
    try {
      const r = await api<{ items: FeedItem[] }>("notifications")
      set({ items: r.items, loaded: true, error: undefined })
    } catch (e) {
      set({ loaded: true, error: (e as Error).message })
    }
  },
  markRead: (id) => {
    set({ items: get().items.map((n) => (n.id === id ? { ...n, read: true } : n)) })
    void api("notifications/read", { method: "POST", body: JSON.stringify({ ids: [id] }) }).catch(() => {})
  },
  markManyRead: (ids) => {
    const selected = new Set(ids)
    set({ items: get().items.map((n) => selected.has(n.id) ? { ...n, read: true } : n) })
    if (ids.length) void api("notifications/read", { method: "POST", body: JSON.stringify({ ids }) }).catch(() => {})
  },
  markAllRead: () => {
    set({ items: get().items.map((n) => ({ ...n, read: true })) })
    void api("notifications/read", { method: "POST", body: JSON.stringify({ all: true }) }).catch(() => {})
  },
}))

let timer: number | undefined
export function startNotifications() {
  if (timer) return
  void useNotifications.getState().refresh()
  timer = window.setInterval(() => document.visibilityState === "visible" && void useNotifications.getState().refresh(), 60_000)
}
export function stopNotifications() {
  window.clearInterval(timer)
  timer = undefined
}
