/**
 * Shows the "Undo" snackbar for a task change that is already saved (no React; the snackbar store and
 * the undo rules are plain TypeScript). The undo is planned inside `mutate`, against the workspace
 * as it is at that moment (not the copy from when the snackbar was shown), saves through the same
 * path as any edit, and the snackbar reports what really happened.
 */
import type { Collections } from "../../../lib/shared.ts"
import { showSnack } from "../../snack/snack-store.ts"
import { planUndo, snackText, type UndoAction } from "./task-undo.ts"

type Mutate = (keys: readonly ["tasks"], change: (d: Collections) => Collections) => Promise<boolean>

/** Runs the undo and returns the sentence to show. Pure apart from `mutate`; exported for tests. */
export async function runUndo(undo: UndoAction, mutate: Mutate, now = new Date().toISOString()): Promise<string> {
  let reason: string | undefined
  let done = ""
  const ok = await mutate(["tasks"], (d) => {
    const plan = planUndo(undo, d, now)
    if (!plan.ok) {
      reason = plan.reason
      return d
    }
    done = plan.done
    return plan.change(d)
  })
  if (reason) return reason
  return ok ? done : "That couldn't be undone. Check the sync status."
}

export function offerUndo(undo: UndoAction, mutate: Mutate): void {
  showSnack(snackText(undo), { label: "Undo", run: () => runUndo(undo, mutate) })
}
