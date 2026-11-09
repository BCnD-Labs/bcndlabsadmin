import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { todayKey } from "@/lib/dates"
import { safeLocalStorage } from "@/stores/storage"
import { MAX_DOCK, MIN_DOCK, sanitizeDock, type DockTool, type ToolId } from "./dock-layout"

export { MAX_DOCK, MIN_DOCK, TOOL_IDS, TOOL_INFO, sanitizeDock, type DockTool, type ToolId } from "./dock-layout"

interface DockState {
  open: boolean
  navOpen: boolean
  width: number
  tools: DockTool[]
  /** The day the Calendar, Tasks and Daily log tools show together. Not saved. */
  date: string
  /** Unsaved Daily log text stays in memory when its window is collapsed or closed. */
  logDrafts: Record<string, string>
  toggleDock(): void
  toggleNav(): void
  setWidth(width: number): void
  addTool(id: ToolId): void
  removeTool(id: ToolId): void
  moveTool(id: ToolId, step: -1 | 1): void
  toggleCollapsed(id: ToolId): void
  setDate(date: string): void
  setLogDraft(key: string, text: string | null): void
}

export const useDock = create<DockState>()(
  persist(
    (set) => ({
      ...sanitizeDock(undefined),
      date: todayKey(),
      logDrafts: {},
      toggleDock: () => set((s) => ({ open: !s.open })),
      toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
      setWidth: (width) => set({ width: Math.min(MAX_DOCK, Math.max(MIN_DOCK, Math.round(width))) }),
      addTool: (id) => set((s) => (s.tools.some((t) => t.id === id) ? { open: true } : { open: true, tools: [...s.tools, { id, collapsed: false }] })),
      removeTool: (id) => set((s) => ({ tools: s.tools.filter((t) => t.id !== id) })),
      moveTool: (id, step) =>
        set((s) => {
          const i = s.tools.findIndex((t) => t.id === id)
          const j = i + step
          if (i < 0 || j < 0 || j >= s.tools.length) return s
          const tools = [...s.tools]
          ;[tools[i], tools[j]] = [tools[j], tools[i]]
          return { tools }
        }),
      toggleCollapsed: (id) => set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, collapsed: !t.collapsed } : t)) })),
      setDate: (date) => set({ date }),
      setLogDraft: (key, text) => set((s) => { const logDrafts = { ...s.logDrafts }; if (text === null) delete logDrafts[key]; else logDrafts[key] = text; return { logDrafts } }),
    }),
    {
      name: "blackwall-mac-dock",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ open: s.open, navOpen: s.navOpen, width: s.width, tools: s.tools }),
      merge: (saved, current) => ({ ...current, ...sanitizeDock(saved) }),
    },
  ),
)
