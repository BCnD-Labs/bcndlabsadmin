import type { StateStorage } from "zustand/middleware"

/** localStorage that degrades to an in-memory map when storage is unavailable. */
const memory = new Map<string, string>()

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return memory.get(name) ?? null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      memory.set(name, value)
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      memory.delete(name)
    }
  },
}
