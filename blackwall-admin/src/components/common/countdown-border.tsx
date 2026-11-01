import { cn } from "@/lib/utils"
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react"

type Props = {
  /** Draw the outline at all (card is pinned / open). */
  active: boolean
  /** The pointer has left: retract the outline over `seconds`. */
  draining: boolean
  seconds: number
  /** Corner radius of the element in px. */
  radius?: number
  /** Position overrides, e.g. "-inset-px" to sit on a 1px border. */
  className?: string
}

/** A 2px red path inset 1px, starting at top-centre and running clockwise. */
function outline(w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius - 1, (w - 2) / 2, (h - 2) / 2))
  const x2 = w - 1
  const y2 = h - 1
  return [
    `M${w / 2} 1`,
    `H${x2 - r}`,
    `A${r} ${r} 0 0 1 ${x2} ${1 + r}`,
    `V${y2 - r}`,
    `A${r} ${r} 0 0 1 ${x2 - r} ${y2}`,
    `H${1 + r}`,
    `A${r} ${r} 0 0 1 1 ${y2 - r}`,
    `V${1 + r}`,
    `A${r} ${r} 0 0 1 ${1 + r} 1`,
    "Z",
  ].join(" ")
}

/**
 * Overlay for an element's border (the calendar and bell buttons): full red while armed, then it retracts
 * around the perimeter like a clock hand once the pointer leaves.
 */
export function CountdownBorder({ active, draining, seconds, radius = 12, className }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])

  if (!active) return null

  return (
    <svg
      ref={ref}
      aria-hidden
      data-testid="countdown-border"
      data-draining={draining}
      className={cn("pointer-events-none absolute inset-0 z-10 size-full overflow-visible", className)}
      style={{ borderRadius: radius }}
    >
      {size.w > 0 && (
        <path
          key={draining ? "draining" : "armed"}
          className="bw-countdown-line"
          data-state={draining ? "draining" : "armed"}
          pathLength={100}
          d={outline(size.w, size.h, radius)}
          style={{ "--bw-countdown": `${seconds}s` } as CSSProperties}
        />
      )}
    </svg>
  )
}
