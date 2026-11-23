/** What the editor tells the writer about where their words are. It is read straight from the sync engine, never guessed. */
export interface SaveState {
  tone: "ok" | "busy" | "warn" | "error"
  label: string
  detail: string
}

export type SyncStatus = "loading" | "saved" | "pending" | "offline" | "conflict"

/**
 * Every keystroke is stored on this device at once, so the useful question is whether the server has it yet:
 * saved (on the server too), saving (waiting for it), offline (only on this device) or in conflict (another device changed the same record).
 */
export function saveState(status: SyncStatus): SaveState {
  switch (status) {
    case "saved": return { tone: "ok", label: "Saved on server", detail: "Your words are saved here and on the server." }
    case "pending": return { tone: "busy", label: "Saving…", detail: "Saved on this device; sending to the server." }
    case "offline": return { tone: "warn", label: "Saved on this device only", detail: "The server can't be reached. Your words are safe here and are sent when it is back." }
    case "conflict": return { tone: "error", label: "Conflict: choose a version", detail: "The same record changed on two devices. Nothing is lost until you choose." }
    default: return { tone: "busy", label: "Loading…", detail: "Loading the shared workspace." }
  }
}
