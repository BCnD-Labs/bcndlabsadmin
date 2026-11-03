import type { CourseworkType, SampleCoursework } from "../../sample.ts"

/** Pure logic for the Learning "Panels" choice. No react-native import, so it is unit-tested directly. */

export type PanelDef = { type: CourseworkType; label: string }
export type PanelState = Record<CourseworkType, boolean>

/** The four panels, in the order they are listed in the popover and shown below the agenda. */
export const PANELS: PanelDef[] = [
  { type: "assignment", label: "Assignments" },
  { type: "exam", label: "Exams" },
  { type: "milestone", label: "Milestones" },
  { type: "event", label: "Events" },
]

/** Every panel off. */
export function initialPanels(): PanelState {
  return { assignment: false, exam: false, milestone: false, event: false }
}

/** A copy of `state` with one panel flipped. */
export function togglePanel(state: PanelState, type: CourseworkType): PanelState {
  return { ...state, [type]: !state[type] }
}

/** How many panels are switched on (the badge on the header button). */
export function panelsOn(state: PanelState): number {
  return PANELS.filter((p) => state[p.type]).length
}

/** The panels that are switched on, in PANELS order. */
export function activePanels(state: PanelState): PanelDef[] {
  return PANELS.filter((p) => state[p.type])
}

/** How many items of one type a course has (the "N in this course" text). */
export function panelCount(items: SampleCoursework[], type: CourseworkType): number {
  return items.filter((w) => w.type === type).length
}

/** The items of one type, earliest due date first (stable for equal dates). */
export function panelList(items: SampleCoursework[], type: CourseworkType): SampleCoursework[] {
  return items.filter((w) => w.type === type).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
}

/** The "Due Nov 4 · Done" line; the caller passes the already formatted date. */
export function panelSubtitle(dueText: string, done: boolean): string {
  return `Due ${dueText}${done ? " · Done" : ""}`
}
