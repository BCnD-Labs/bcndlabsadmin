/**
 * Learning reflections are journal entries linked to a course and/or a task. The answers are saved as readable
 * lines, so every app (and an older one that only knows journal text) shows them:
 *
 *   ## Learning reflection
 *   Clicked: ...
 *   Still fuzzy: ...
 *   Next step: ...
 *
 *   Notes:
 *   free text
 *
 * The Android app writes and reads the same lines.
 */
export interface LearningAnswers { clicked: string; fuzzy: string; next: string; notes: string }
export const EMPTY_LEARNING_ANSWERS: LearningAnswers = { clicked: "", fuzzy: "", next: "", notes: "" }

export const LEARNING_PROMPTS = [["clicked", "What clicked?"], ["fuzzy", "Still fuzzy?"], ["next", "Next small step?"]] as const
const LINE_FIELDS = { Clicked: "clicked", "Still fuzzy": "fuzzy", "Next step": "next" } as const
const HEADER = "## Learning reflection"

export function writeLearningReflection(a: LearningAnswers): string {
  const lines = [HEADER]
  for (const [label, value] of [["Clicked", a.clicked], ["Still fuzzy", a.fuzzy], ["Next step", a.next]] as const) {
    if (value.trim()) lines.push(`${label}: ${value.trim().replace(/\s*\n\s*/g, " ")}`)
  }
  if (a.notes.trim()) lines.push("", "Notes:", a.notes.trim())
  return lines.join("\n")
}

/** Reads the lines back. Text that was not written by this format (an older plain reflection) is kept whole as the notes. */
export function readLearningReflection(text: string): LearningAnswers {
  const answers = { ...EMPTY_LEARNING_ANSWERS }
  if (!text.trimStart().startsWith(HEADER)) return { ...answers, notes: text.trim() }
  const [head, ...rest] = text.split("\nNotes:\n")
  for (const line of head.split("\n")) {
    const match = /^(Clicked|Still fuzzy|Next step): (.*)$/.exec(line)
    if (match) answers[LINE_FIELDS[match[1] as keyof typeof LINE_FIELDS]] = match[2]
  }
  answers.notes = rest.join("\nNotes:\n")
  return answers
}

export const hasLearningAnswers = (a: LearningAnswers) => !!(a.clicked.trim() || a.fuzzy.trim() || a.next.trim() || a.notes.trim())

/** One line for a list row: the first answer that has words. */
export const learningPreview = (text: string) => {
  const a = readLearningReflection(text)
  return a.clicked || a.fuzzy || a.next || a.notes.split("\n").find((l) => l.trim()) || "Learning reflection"
}
