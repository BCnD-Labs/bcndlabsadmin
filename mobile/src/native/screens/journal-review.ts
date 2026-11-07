import { addDays, weekDays } from "./planner/dates.ts"

export type Period = "daily" | "weekly" | "monthly" | "yearly"
export type CheckIn = { mood: string; energy: string; win: string; hard: string; grateful: string; checks: string[]; notes: string }
export const EMPTY_CHECK_IN: CheckIn = { mood: "", energy: "", win: "", hard: "", grateful: "", checks: [], notes: "" }
export const CHECKS = ["Learned", "Made progress", "Connected", "Rested", "Moved"] as const
/** The saved value stays short (older entries use it); this is the wording shown on screen. */
export const CHECK_LABELS: Record<(typeof CHECKS)[number], string> = { Learned: "Learned something", "Made progress": "Made progress", Connected: "Spent time with people", Rested: "Rested", Moved: "Exercised or moved" }

/** A day has three check-ins. Entries saved before this have no slot and are shown as one earlier check-in. */
export type Slot = "morning" | "afternoon" | "evening"
export const SLOTS: readonly { key: Slot; label: string; blurb: string }[] = [
  { key: "morning", label: "Morning", blurb: "Set up the day" },
  { key: "afternoon", label: "Afternoon", blurb: "Check how it is going" },
  { key: "evening", label: "Evening", blurb: "Look back on the day" },
]
export const slotLabel = (slot: Slot): string => SLOTS.find(s => s.key === slot)?.label ?? slot

/** Which check-in is "now" by the clock: before noon, before 5 pm, otherwise evening. */
export const slotForHour = (hour: number): Slot => hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"

export type Prompt = { key: "win" | "hard" | "grateful"; /** Label in the saved text. */ label: string; question: string; placeholder: string }
export interface FormWording { title: string; mood: string; energy: string; checks: string; prompts: Prompt[]; notes: string; save: string }

const PERIOD_NOUN: Record<Period, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }
const PERIOD_PROMPTS: Record<Period, [string, string, string]> = {
  daily: ["What was one win today?", "What was hard today?", "What are you grateful for?"],
  weekly: ["What was the best part of this week?", "What got in the way?", "What is worth remembering?"],
  monthly: ["What progress did you make this month?", "What would you change?", "What is worth remembering?"],
  yearly: ["What grew this year?", "What was the hardest lesson?", "What mattered most?"],
}
const SLOT_PROMPTS: Record<Slot, [Prompt["label"], string, string][]> = {
  morning: [["Focus", "What is the main thing you want to get done today?", "For example: finish the lab report"], ["Might get in the way", "What could get in the way?", "For example: a long meeting"], ["Looking forward to", "What are you looking forward to?", "Anything, big or small"]],
  afternoon: [["Going well", "What has gone well so far today?", "Anything that went right"], ["Stuck on", "What has been hard or stuck?", "What slowed you down"], ["Next up", "What is next before the day ends?", "The next thing to do"]],
  evening: [["Win", "What was one win today?", "Anything that went right"], ["Hard", "What was hard today?", "What was difficult"], ["Grateful", "What are you grateful for?", "Anything, big or small"]],
}

/** The words the form uses. `slot` only applies to the daily period. Every prompt is optional. */
export function formWording(period: Period, slot?: Slot): FormWording {
  const noun = PERIOD_NOUN[period]
  const keys = ["win", "hard", "grateful"] as const
  if (period === "daily" && slot) {
    const mood = slot === "morning" ? "How are you feeling this morning?" : slot === "afternoon" ? "How are you feeling this afternoon?" : "How are you feeling this evening?"
    return { title: `${slotLabel(slot)} check-in`, mood, energy: "How is your energy?", checks: "What have you done today? Tick any.", prompts: SLOT_PROMPTS[slot].map(([label, question, placeholder], i) => ({ key: keys[i], label, question, placeholder })), notes: "Anything else on your mind? (optional)", save: `Save ${slot} check-in` }
  }
  const title = period === "daily" ? "Daily check-in" : `${period[0].toUpperCase()}${period.slice(1)} review`
  return { title, mood: `How was your ${noun} overall?`, energy: `How was your energy this ${noun}?`, checks: `What happened this ${noun}? Tick any.`, prompts: PERIOD_PROMPTS[period].map((question, i) => ({ key: keys[i], label: ["Win", "Hard", "Grateful"][i], question, placeholder: "A few words is plenty" })), notes: "Anything else on your mind? (optional)", save: period === "daily" ? "Save check-in" : "Save review" }
}

/** One line for the list: mood, energy, then the first thing written. Empty when nothing was filled in. */
export function checkInSummary(form: CheckIn): string {
  const text = [form.win, form.hard, form.grateful, form.notes].map(x => x.trim().replace(/\s+/g, " ")).find(Boolean)
  return [form.mood, form.energy && `${form.energy} energy`, form.checks.length ? `${form.checks.length} ticked` : "", text].filter(Boolean).join(" · ")
}

export function periodStart(period: Period, day: string): string {
  if (period === "weekly") return weekDays(day)[0]
  if (period === "monthly") return `${day.slice(0, 7)}-01`
  if (period === "yearly") return `${day.slice(0, 4)}-01-01`
  return day
}

export function nextPeriod(period: Period, start: string, direction: 1 | -1): string {
  if (period === "daily") return addDays(start, direction)
  if (period === "weekly") return addDays(start, direction * 7)
  const year = Number(start.slice(0, 4)), month = Number(start.slice(5, 7))
  const date = new Date(Date.UTC(year + (period === "yearly" ? direction : 0), month - 1 + (period === "monthly" ? direction : 0), 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
}

/** Daily check-ins add their slot; without one this is the id older versions used. */
export function reviewId(period: Period, start: string, slot?: Slot): string { return `journal-${period}-${start}${slot ? `-${slot}` : ""}` }

/** Human-readable text, so the web and Mac apps can display a check-in without understanding this form. */
export function writeCheckIn(period: Period, form: CheckIn, slot?: Slot): string {
  const lines = [`## ${slot ? slotLabel(slot) : period[0].toUpperCase() + period.slice(1)} check-in`]
  const [win, hard, grateful] = formWording(period, slot).prompts
  for (const [label, value] of [["Mood", form.mood], ["Energy", form.energy], [win.label, form.win], [hard.label, form.hard], [grateful.label, form.grateful]]) {
    if (value.trim()) lines.push(`${label}: ${value.trim().replace(/\s*\n\s*/g, " ")}`)
  }
  for (const label of CHECKS) if (form.checks.includes(label)) lines.push(`- [x] ${label}`)
  if (form.notes.trim()) lines.push("", "Notes:", form.notes.trim())
  return lines.join("\n")
}

const LABEL_KEY: Record<string, "mood" | "energy" | "win" | "hard" | "grateful" | undefined> = { Mood: "mood", Energy: "energy", Win: "win", Hard: "hard", Grateful: "grateful" }
for (const slot of ["morning", "afternoon", "evening"] as const) formWording("daily", slot).prompts.forEach(p => { LABEL_KEY[p.label] = p.key })
const FIELD = new RegExp(`^(${Object.keys(LABEL_KEY).join("|")}): (.*)$`)

export function readCheckIn(text: string): CheckIn {
  const form: CheckIn = { ...EMPTY_CHECK_IN, checks: [] }
  const [head, ...notes] = text.split("\nNotes:\n")
  for (const line of head.split("\n")) {
    const field = FIELD.exec(line)
    if (field) {
      const key = LABEL_KEY[field[1]]
      if (key) form[key] = field[2]
    }
    const check = /^- \[x\] (.*)$/.exec(line)
    if (check && CHECKS.some(label => label === check[1])) form.checks.push(check[1])
  }
  form.notes = notes.join("\nNotes:\n")
  return form
}

export const hasCheckIn = (form: CheckIn): boolean => !!(form.mood || form.energy || form.win.trim() || form.hard.trim() || form.grateful.trim() || form.checks.length || form.notes.trim())
