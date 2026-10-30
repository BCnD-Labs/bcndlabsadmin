import { useEffect, useState } from "react"

/** Resolve a service call and re-run when `deps` change. */
export function useServiceData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined)
  useEffect(() => {
    let live = true
    load().then((d) => live && setData(d))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return data
}
