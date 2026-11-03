/**
 * The one snackbar the app shows at a time (pure: no React). A screen calls `showSnack` after an
 * action; the host (SnackHost) subscribes, draws it and removes it after `ms`. An action runs once
 * and answers with the sentence to show next, so the message always says what really happened.
 */
export interface SnackAction { label: string; run: () => Promise<string> }
export interface Snack { id: number; text: string; action?: SnackAction; ms: number }

export const SNACK_MS = 6000
export const RESULT_MS = 3500

let current: Snack | null = null
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const getSnack = (): Snack | null => current

export function subscribeSnack(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** Shows a snackbar in place of any current one and returns its id. */
export function showSnack(text: string, action?: SnackAction, ms = SNACK_MS): number {
  current = { id: ++seq, text, action, ms }
  emit()
  return current.id
}

/** Removes the snackbar `id` (or whichever is showing, without an id). A stale id changes nothing. */
export function dismissSnack(id?: number): void {
  if (!current || (id !== undefined && id !== current.id)) return
  current = null
  emit()
}

/** Runs the snackbar's action once, then shows what it answered for a moment. */
export async function runSnackAction(snack: Snack): Promise<void> {
  if (!snack.action || current?.id !== snack.id) return
  const run = snack.action.run
  showSnack("Undoing…", undefined, 20_000)
  let text: string
  try {
    text = await run()
  } catch {
    text = "That couldn't be undone."
  }
  showSnack(text, undefined, RESULT_MS)
}
