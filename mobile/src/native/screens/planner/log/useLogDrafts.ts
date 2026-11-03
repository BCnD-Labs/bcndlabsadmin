import { useCallback, useEffect, useRef, useState } from "react"
import { saveJournal, type Collections } from "../../../../lib/shared.ts"
import type { WorkspaceValue } from "../../../data/WorkspaceProvider.tsx"
import { resolveWithin } from "../task-form.ts"
import { reconcileDrafts, type Drafts } from "./log-rules.ts"

/** How long typing pauses before the log saves by itself. Leaving the box saves at once. */
export const SAVE_DELAY = 900

const without = (flags: Record<string, true>, day: string) => {
  const { [day]: _gone, ...rest } = flags
  return rest
}

/**
 * Typed-but-unsaved log text, per day, and the saving of it through the shared `saveJournal` rule.
 * Lives in the Planner screen (not the Log tab), so text survives switching tabs. A draft is kept
 * until the workspace shows the same text, so a refused or failed save never loses typing.
 */
export function useLogDrafts(journal: Collections["journal"] | undefined, mutate: WorkspaceValue["mutate"], allowed: boolean) {
  const [drafts, setDrafts] = useState<Drafts>({})
  const [saving, setSaving] = useState<Record<string, true>>({})
  const [failed, setFailed] = useState<Record<string, true>>({})
  const live = useRef({ drafts, mutate, allowed })
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const busy = useRef(new Set<string>())
  const again = useRef(new Set<string>())
  live.current.mutate = mutate
  live.current.allowed = allowed

  const put = useCallback((next: Drafts) => {
    live.current.drafts = next
    setDrafts(next)
  }, [])

  // Once the workspace holds a draft's text (saved or queued), the draft has done its job.
  useEffect(() => {
    if (!journal) return
    const next = reconcileDrafts(live.current.drafts, journal)
    if (next !== live.current.drafts) put(next)
  }, [journal, put])

  /** Saves a day's draft now. A save already running for the day is asked to go again afterwards. */
  const save = useCallback(
    async function run(day: string) {
      clearTimeout(timers.current.get(day))
      timers.current.delete(day)
      const text = live.current.drafts[day]
      if (text === undefined) return
      if (busy.current.has(day)) return void again.current.add(day)
      if (!live.current.allowed) return setFailed((f) => ({ ...f, [day]: true }))
      busy.current.add(day)
      setSaving((s) => ({ ...s, [day]: true }))
      let ok = false
      try {
        // A refusal comes back at once; offline edits are queued on the phone, which counts as saved.
        ok = await resolveWithin(live.current.mutate(["journal"], (d) => saveJournal(d, day, text)), 1500, true)
      } catch {
        ok = false
      }
      busy.current.delete(day)
      setSaving((s) => without(s, day))
      setFailed((f) => (ok ? without(f, day) : { ...f, [day]: true }))
      if (again.current.delete(day) && ok) void run(day)
    },
    [],
  )

  /** Types into a day. Saves after a pause, or straight away with `now`. */
  const edit = useCallback(
    (day: string, text: string, now = false) => {
      put({ ...live.current.drafts, [day]: text })
      setFailed((f) => without(f, day))
      clearTimeout(timers.current.get(day))
      if (now) void save(day)
      else timers.current.set(day, setTimeout(() => void save(day), SAVE_DELAY))
    },
    [put, save],
  )

  // Leaving the Planner saves whatever is waiting on a timer.
  useEffect(() => () => [...timers.current.keys()].forEach((day) => void save(day)), [save])

  return { drafts, saving, failed, edit, save }
}

export type LogDrafts = ReturnType<typeof useLogDrafts>
