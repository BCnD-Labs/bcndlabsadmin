import type { StateStorage } from "zustand/middleware"

/** localStorage that degrades to an in-memory map when storage is unavailable. */
const memory = new Map<string, string>()

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (memory.has(name)) return memory.get(name)!
    try {
      return window.localStorage.getItem(name)
    } catch {
      return memory.get(name) ?? null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
      memory.delete(name)
    } catch {
      memory.set(name, value)
    }
  },
  removeItem: (name) => {
    memory.delete(name)
    try {
      window.localStorage.removeItem(name)
    } catch {
      memory.delete(name)
    }
  },
}

/** False means quota/privacy restrictions left the latest copy in memory only. */
export const storageIsDurable = (name: string) => !memory.has(name)
