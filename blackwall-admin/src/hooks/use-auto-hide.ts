import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react"
import { usePrefs } from "@/stores/prefs"

/**
 * Spec §4 auto-hide for floating cards: when a mouse leaves the open card, start
 * a timer (Settings → Appearance, default 5s) and retract the card's red countdown border;
 * re-entering cancels it. Call `disarm` whenever the card closes another way.
 */
export function useAutoHide(open: boolean, close: () => void) {
  const seconds = usePrefs((s) => s.autoHideSeconds)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current)
    setLeaving(false)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onPointerEnter = (e: PointerEvent) => e.pointerType === "mouse" && disarm()
  const onPointerLeave = (e: PointerEvent) => {
    if (!open || e.pointerType !== "mouse") return
    window.clearTimeout(timer.current)
    setLeaving(true)
    timer.current = window.setTimeout(() => {
      setLeaving(false)
      closeRef.current()
    }, seconds * 1000)
  }

  return { leaving: open && leaving, seconds, disarm, onPointerEnter, onPointerLeave }
}
