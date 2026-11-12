import { useCallback, useEffect, useRef, useState } from "react"
import * as SecureStore from "expo-secure-store"
import { DEFAULT_HOME_PREFS, sanitizeHomePrefs, type HomePrefs } from "./home-prefs.ts"

const KEY = "blackwall.homePrefs"
/** Home layout belongs to this phone, never the shared workspace. */
export function useHomePrefs() {
  const [prefs, setPrefs] = useState<HomePrefs>(DEFAULT_HOME_PREFS)
  const changed = useRef(false), pending = useRef(Promise.resolve())
  useEffect(() => {
    let alive = true
    void SecureStore.getItemAsync(KEY).then(raw => {
      if (alive && !changed.current) { try { setPrefs(sanitizeHomePrefs(JSON.parse(raw ?? "null"))) } catch {} }
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  const update = useCallback((patch: Partial<HomePrefs>) => {
    changed.current = true
    setPrefs(old => {
      const next = sanitizeHomePrefs({ ...old, ...patch })
      pending.current = pending.current.then(() => SecureStore.setItemAsync(KEY, JSON.stringify(next))).catch(() => {})
      return next
    })
  }, [])
  return [prefs, update] as const
}
