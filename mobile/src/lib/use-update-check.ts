import Constants from "expo-constants"
import { useCallback, useEffect, useState } from "react"
import { checkForUpdate, type UpdateResult } from "./app-update.ts"

/** This app's build number (versionCode), as set in app.json. */
export const installedBuild: number = Constants.expoConfig?.android?.versionCode ?? 1

/**
 * Checks the server for a newer build once when the app opens (silently: failures stay quiet),
 * and again whenever `recheck` is called. `result` is null until the first check finishes.
 */
export function useUpdateCheck(address: string | null) {
  const [result, setResult] = useState<UpdateResult | "checking" | null>(null)

  const recheck = useCallback(async () => {
    if (!address) return
    setResult("checking")
    setResult(await checkForUpdate(address, installedBuild))
  }, [address])

  useEffect(() => {
    if (!address) return
    let cancelled = false
    void checkForUpdate(address, installedBuild).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [address])

  return { result, recheck }
}
