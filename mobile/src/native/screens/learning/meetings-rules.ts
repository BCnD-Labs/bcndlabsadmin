import type { ClassMeeting } from "../../../lib/shared.ts"

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
/** The first thing wrong with these times, in plain words, or nothing. */
export function meetingsProblem(meetings: ClassMeeting[]): string | undefined {
  for (const m of meetings) {
    if (!TIME.test(m.start) || !TIME.test(m.end)) return "Use 24-hour times like 09:30 for class times."
    if (m.end <= m.start) return "A class time must end after it starts."
  }
  return undefined
}

