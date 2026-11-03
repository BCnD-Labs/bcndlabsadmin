/** Blackwall's Dim theme tokens (blackwall-admin/src/styles/theme.css and docs/design/BLACKWALL_DESIGN.md). */
export const color = {
  ground: "#1f2228",
  panel: "#2a2f37",
  raised: "#323842",
  selected: "#3a414c",
  well: "#1c1f25",
  edge: "#343a44",
  line: "#373d47",
  border: "#444b57",
  red: "#c92a2a",
  redPressed: "#b52424",
  errorText: "#ffa8a8",
  text: "#e7eaee",
  text2: "#c8cdd4",
  muted: "#aab1bc",
  faint: "#99a1ad",
} as const

export const mono = "monospace"

/** The web's note paper colours (features/notes/note-colors.ts) and the dark ink that sits on them. */
export const notePaper = { plain: "#bcc2cc", amber: "#cfbb7c", teal: "#8ebdaf", rose: "#c9a2b3", blue: "#9eaecb" } as const
export const noteInk = "#14171c"
