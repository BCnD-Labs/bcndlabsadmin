/** Time-axis geometry for the Day and Week views (pure): which hours to draw and where each block goes. */
import type { Lane } from "./schedule.ts"

export interface HourRange { from: number; to: number }

/** Hours drawn when nothing falls outside them; the axis grows to fit earlier or later items. */
export const DEFAULT_HOURS: HourRange = { from: 7, to: 19 }

/** Whole hours to draw so every timed item is visible (the phone page scrolls, so the axis is not a fixed 24 hours). */
export function hourRange(lanes: readonly Lane[], base: HourRange = DEFAULT_HOURS): HourRange {
  let { from, to } = base
  for (const l of lanes) {
    from = Math.min(from, Math.floor(l.start / 60))
    to = Math.max(to, Math.ceil(l.end / 60))
  }
  from = Math.max(0, from)
  return { from, to: Math.min(24, Math.max(to, from + 1)) }
}

export interface Box { top: number; height: number; leftPct: number; widthPct: number }

/** Offset and size of a block inside its day column. A block is never shorter than `minHeight`, so it can still be tapped. */
export function blockBox(lane: Lane, range: HourRange, hourHeight: number, minHeight: number): Box {
  return {
    top: ((lane.start - range.from * 60) / 60) * hourHeight,
    height: Math.max(minHeight, ((lane.end - lane.start) / 60) * hourHeight),
    leftPct: (lane.lane / lane.lanes) * 100,
    widthPct: 100 / lane.lanes,
  }
}

export const axisHeight = (range: HourRange, hourHeight: number): number => (range.to - range.from) * hourHeight

/** HH:mm of a minute of the day (0 to 1439). */
export const minuteToTime = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
