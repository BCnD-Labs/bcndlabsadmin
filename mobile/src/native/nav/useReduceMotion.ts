import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/** True while the system "remove animations" / reduce-motion setting is on; follows changes live. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduce(on))
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduce
}
