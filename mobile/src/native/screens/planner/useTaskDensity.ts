import { useCallback, useEffect, useState } from "react"
import { loadTaskDensity, saveTaskDensity } from "../../../lib/storage.ts"
import { DEFAULT_DENSITY, otherDensity, type Density } from "./density.ts"

/** The saved row density for this phone, and a function that flips it (and saves the choice). Starts comfortable until the saved value loads. */
export function useTaskDensity(): [Density, () => void] {
  const [density, setDensity] = useState<Density>(DEFAULT_DENSITY)
  useEffect(() => {
    let alive = true
    loadTaskDensity().then((d) => alive && setDensity(d))
    return () => {
      alive = false
    }
  }, [])
  const flip = useCallback(() => {
    const next = otherDensity(density)
    setDensity(next)
    void saveTaskDensity(next)
  }, [density])
  return [density, flip]
}
