/** Extra occlusion only: Android may already have resized the window above the IME. */
export function keyboardInset(top: number, height: number, keyboardTop: number | null): number {
  return keyboardTop == null ? 0 : Math.max(0, Math.min(height, top + height - keyboardTop))
}
export function focusScroll(offset: number, fieldTop: number, fieldHeight: number, viewportTop: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return offset
  const bottom = viewportTop + viewportHeight - 16
  if (fieldTop + fieldHeight > bottom) return Math.max(0, offset + fieldTop + fieldHeight - bottom)
  return fieldTop < viewportTop + 8 ? Math.max(0, offset + fieldTop - viewportTop - 8) : offset
}
