import type { NoteColor } from "@/lib/types"

/**
 * Paper colours with dark ink. Muted (low chroma, mid-light) so a wall of notes
 * sits calmly on the dark ground; ink stays ≥ 8:1 on every one.
 */
export const NOTE_COLORS: { value: NoteColor; label: string; card: string; swatch: string }[] = [
  { value: "plain", label: "Plain", card: "bg-[#bcc2cc] text-[#14171c]", swatch: "bg-[#bcc2cc]" },
  { value: "amber", label: "Yellow", card: "bg-[#cfbb7c] text-[#14171c]", swatch: "bg-[#cfbb7c]" },
  { value: "teal", label: "Mint", card: "bg-[#8ebdaf] text-[#14171c]", swatch: "bg-[#8ebdaf]" },
  { value: "rose", label: "Pink", card: "bg-[#c9a2b3] text-[#14171c]", swatch: "bg-[#c9a2b3]" },
  { value: "blue", label: "Blue", card: "bg-[#9eaecb] text-[#14171c]", swatch: "bg-[#9eaecb]" },
]

export const noteColor = (c: NoteColor) => NOTE_COLORS.find((n) => n.value === c) ?? NOTE_COLORS[0]

/** First line of a note, used as its name in search and lists. */
export const noteTitle = (text: string) => text.trim().split("\n")[0]?.slice(0, 80) || "Empty note"
