export type WindowRect = { x: number; y: number; width: number; height: number }

/** Touching edges are allowed; overlapping desktop widgets are not. */
export function overlaps(a: WindowRect, b: WindowRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Follow the pointer path in short steps so a quick drag cannot jump through a locked widget. */
export function moveAroundLocked(start: WindowRect, dx: number, dy: number, locked: readonly WindowRect[]): WindowRect {
  if (!locked.length) return { ...start, x: start.x + dx, y: start.y + dy }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6))
  let current = { ...start }
  for (let step = 1; step <= steps; step++) {
    const goalX = start.x + dx * step / steps
    const goalY = start.y + dy * step / steps
    const x = { ...current, x: goalX }
    const xPath = { ...current, x: Math.min(current.x, goalX), width: current.width + Math.abs(goalX - current.x) }
    if (!locked.some((blocker) => overlaps(xPath, blocker))) current = x
    const y = { ...current, y: goalY }
    const yPath = { ...current, y: Math.min(current.y, goalY), height: current.height + Math.abs(goalY - current.y) }
    if (!locked.some((blocker) => overlaps(yPath, blocker))) current = y
  }
  return current
}

/** Resizing a widget may touch a locked widget, but cannot cover it. */
export function resizeAroundLocked(previous: WindowRect, next: WindowRect, locked: readonly WindowRect[]): WindowRect {
  return locked.some((blocker) => overlaps(next, blocker)) ? previous : next
}

/** Reopen a widget near its last position without covering a locked widget. */
export function placeOutsideLocked(rect: WindowRect, locked: readonly WindowRect[], bounds: { width: number; height: number }): WindowRect | null {
  const minX = 45, minY = 43
  const maxX = bounds.width - rect.width - 8, maxY = bounds.height - rect.height - 8
  if (maxX < minX || maxY < minY) return null
  const candidates: WindowRect[] = []
  for (let y = minY; y <= maxY; y += 16) for (let x = minX; x <= maxX; x += 16) candidates.push({ ...rect, x, y })
  candidates.push({ ...rect, x: maxX, y: maxY })
  candidates.sort((a, b) => Math.abs(a.x - rect.x) + Math.abs(a.y - rect.y) - Math.abs(b.x - rect.x) - Math.abs(b.y - rect.y))
  return candidates.find(candidate => !locked.some(blocker => overlaps(candidate, blocker))) ?? null
}
