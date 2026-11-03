import * as SecureStore from "expo-secure-store"
import { sanitizeNavSide, type NavSide } from "../native/nav/side.ts"
import { normalizeAddress } from "./url.ts"
import type { ViewMode } from "./view-mode.ts"

/**
 * Everything the app remembers, kept on this phone only (Android Keystore-backed
 * SecureStore; app backup is off in app.json). No passwords: the sign-in password is sent once to the server and never saved.
 */
const KEYS = {
  address: "blackwall.address",
  viewMode: "blackwall.viewMode",
  handle: "blackwall.settingsHandle",
  navSide: "blackwall.navSide",
} as const

/** Your saved Blackwall start URL, re-validated on read. Null if none is saved or it's no longer valid. */
export async function loadAddress(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYS.address).catch(() => null)
  if (!stored) return null
  const r = normalizeAddress(stored)
  return r.ok ? r.url : null
}

export async function saveAddress(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.address, url)
}

export async function clearAddress(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.address)
}

export async function loadViewMode(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.viewMode).catch(() => null)
}

export async function saveViewMode(mode: ViewMode): Promise<void> {
  await SecureStore.setItemAsync(KEYS.viewMode, mode)
}

export type HandlePosition = { side: "left" | "right"; y: number }

/** Where you last left the Settings handle (fraction of the usable height, 0–1). */
export async function loadHandle(): Promise<HandlePosition> {
  const fallback: HandlePosition = { side: "right", y: 0.42 }
  try {
    const raw = JSON.parse((await SecureStore.getItemAsync(KEYS.handle)) ?? "null")
    if (raw && (raw.side === "left" || raw.side === "right") && typeof raw.y === "number" && raw.y >= 0 && raw.y <= 1) return raw
  } catch {
    // fall through
  }
  return fallback
}

export async function saveHandle(p: HandlePosition): Promise<void> {
  await SecureStore.setItemAsync(KEYS.handle, JSON.stringify(p)).catch(() => {})
}

/** Where the floating navigation bubble sits. Never rejects; anything missing or unknown is "right". */
export async function loadNavSide(): Promise<NavSide> {
  try {
    return sanitizeNavSide(await SecureStore.getItemAsync(KEYS.navSide))
  } catch {
    return sanitizeNavSide(null)
  }
}

export async function saveNavSide(side: NavSide): Promise<void> {
  await SecureStore.setItemAsync(KEYS.navSide, side).catch(() => {})
}
