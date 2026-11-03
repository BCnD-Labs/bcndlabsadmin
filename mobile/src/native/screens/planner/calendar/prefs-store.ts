import * as SecureStore from "expo-secure-store"
import { DEFAULT_CALENDAR_PREFS, parseCalendarPrefs, serializeCalendarPrefs, type CalendarPrefs } from "./prefs.ts"

/** Saved on this phone only, like the other display choices in lib/storage.ts (nothing from the account in it). */
const KEY = "blackwall.calendarPrefs"

/** Never rejects; anything missing or unreadable gives the defaults. */
export async function loadCalendarPrefs(): Promise<CalendarPrefs> {
  try {
    return parseCalendarPrefs(await SecureStore.getItemAsync(KEY))
  } catch {
    return { ...DEFAULT_CALENDAR_PREFS }
  }
}

export async function saveCalendarPrefs(prefs: CalendarPrefs): Promise<void> {
  await SecureStore.setItemAsync(KEY, serializeCalendarPrefs(prefs)).catch(() => {})
}
