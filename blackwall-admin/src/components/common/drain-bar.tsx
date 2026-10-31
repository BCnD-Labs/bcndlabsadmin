import type { CSSProperties } from "react"

/** The 2px red bar that drains while a floating card counts down to auto-hide. */
export function DrainBar({ seconds }: { seconds: number }) {
  return <div className="bw-drain" style={{ "--bw-drain": `${seconds}s` } as CSSProperties} role="presentation" data-testid="drain-bar" />
}
