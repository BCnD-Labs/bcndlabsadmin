import type { NoteColor } from "@/lib/types"

/** Paper colours with dark ink (all ≥ 9:1). */
export const NOTE_COLORS: { value: NoteColor; label: string; card: string; swatch: string }[] = [
  { value: "plain", label: "Plain", card: "bg-[#e6e9ee] text-[#111418]", swatch: "bg-[#e6e9ee]" },
  { value: "amber", label: "Yellow", card: "bg-[#ffd84d] text-[#111418]", swatch: "bg-[#ffd84d]" },
  { value: "teal", label: "Mint", card: "bg-[#5cebd0] text-[#111418]", swatch: "bg-[#5cebd0]" },
  { value: "rose", label: "Pink", card: "bg-[#ff9acb] text-[#111418]", swatch: "bg-[#ff9acb]" },
  { value: "blue", label: "Blue", card: "bg-[#a9c8ff] text-[#111418]", swatch: "bg-[#a9c8ff]" },
]

export const noteColor = (c: NoteColor) => NOTE_COLORS.find((n) => n.value === c) ?? NOTE_COLORS[0]

/** First line of a note, used as its name in search and lists. */
export const noteTitle = (text: string) => text.trim().split("\n")[0]?.slice(0, 80) || "Empty note"
