import { useEffect, useState } from "react"

/** The current time, re-rendering at the start of every minute. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let t: number
    const tick = () => {
      const d = new Date()
      setNow(d)
      t = window.setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50)
    }
    t = window.setTimeout(tick, 60_000 - (new Date().getSeconds() * 1000 + new Date().getMilliseconds()) + 50)
    return () => window.clearTimeout(t)
  }, [])
  return now
}
