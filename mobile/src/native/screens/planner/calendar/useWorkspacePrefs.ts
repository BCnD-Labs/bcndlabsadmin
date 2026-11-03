import { useCallback, useEffect, useRef, useState } from "react"
import * as SecureStore from "expo-secure-store"
import { DEFAULT_WORKSPACE_PREFS, sanitizeWorkspacePrefs, type WorkspacePrefs } from "./workspace-prefs.ts"
const KEY = "blackwall.plannerWorkspace"
export function useWorkspacePrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_WORKSPACE_PREFS)
  const changed = useRef(false), pending = useRef(Promise.resolve())
  useEffect(() => {
    let alive = true
    void SecureStore.getItemAsync(KEY).then(raw => {
      if (alive && !changed.current) { try { setPrefs(sanitizeWorkspacePrefs(JSON.parse(raw ?? "null"))) } catch {} }
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  const update = useCallback((patch: Partial<WorkspacePrefs>) => {
    changed.current = true
    setPrefs(old => {
      const next = sanitizeWorkspacePrefs({ ...old, ...patch })
      pending.current = pending.current.then(() => SecureStore.setItemAsync(KEY, JSON.stringify(next))).catch(() => {})
      return next
    })
  }, [])
  return [prefs, update] as const
}
