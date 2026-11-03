import { plannerColor as p } from "./native/planner-theme.ts"

/** Native neutral-charcoal surfaces; brand red remains separate from planner actions. */
export const color = {
  ground: p.ground,
  panel: p.panel,
  raised: p.raised,
  selected: p.selected,
  well: "#232426",
  edge: p.line,
  line: p.line,
  border: p.border,
  red: "#c92a2a",
  redPressed: "#b52424",
  errorText: "#ffa8a8",
  text: p.text,
  text2: p.text2,
  muted: p.muted,
  faint: p.muted,
} as const

export const mono = "monospace"

/** The web's note paper colours (features/notes/note-colors.ts) and the dark ink that sits on them. */
export const notePaper = { plain: "#bcc2cc", amber: "#cfbb7c", teal: "#8ebdaf", rose: "#c9a2b3", blue: "#9eaecb" } as const
export const noteInk = "#14171c"
