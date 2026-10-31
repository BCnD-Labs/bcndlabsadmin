import { create } from "zustand"
import type { Timestamp } from "@/lib/types"

export type NotificationKind = "alerts" | "dev" | "site"

export interface BwNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** Where it came from, e.g. "github". */
  source: string
  at: Timestamp
  read: boolean
}

/**
 * Something that produces notifications (GitHub checks, uptime alerts, site
 * analytics…). None exist yet; a source added here feeds the bell and card.
 */
export interface NotificationSource {
  id: string
  name: string
  kinds: NotificationKind[]
  fetch: () => Promise<Omit<BwNotification, "read">[]>
}

export const NOTIFICATION_SOURCES: NotificationSource[] = []

interface NotificationState {
  items: BwNotification[]
  markRead: (id: string) => void
  markAllRead: () => void
}

/** In-memory feed. Stays empty until a source is connected; nothing is invented. */
export const useNotifications = create<NotificationState>()((set, get) => ({
  items: [],
  markRead: (id) => set({ items: get().items.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
  markAllRead: () => set({ items: get().items.map((n) => ({ ...n, read: true })) }),
}))
