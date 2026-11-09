/**
 * Journal check-ins and period reviews as pure rules, shared by the Mac/web Journal page and the Android
 * app so a check-in made on one reads the same on the other. Answers are saved as readable text lines.
 */
import { addDaysToKey, weekdayOfKey } from "./date-keys.ts"

const addDays = (day: string, n: number): string => addDaysToKey(day, n) ?? day
/** The seven days of the week containing `day`, Monday first (reviews always run Monday to Sunday, on every device). */
const weekDays = (day: string): string[] => {
  const monday = addDays(day, -((weekdayOfKey(day) + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export type Period = "daily" | "weekly" | "monthly" | "yearly"

// ---------------------------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------------------------

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

/** Daily check-ins add their slot; without one this is the id older versions used for the whole day. */
export function reviewId(period: Period, start: string, slot?: Slot): string { return `journal-${period}-${start}${slot ? `-${slot}` : ""}` }

// ---------------------------------------------------------------------------------------------
// Reviews (weekly, monthly, yearly) and the earlier one-per-day check-in: short written answers
// ---------------------------------------------------------------------------------------------

export type CheckIn = { mood: string; energy: string; win: string; hard: string; grateful: string; checks: string[]; notes: string }
export const EMPTY_CHECK_IN: CheckIn = { mood: "", energy: "", win: "", hard: "", grateful: "", checks: [], notes: "" }
export const CHECKS = ["Learned", "Made progress", "Connected", "Rested", "Moved"] as const
/** The saved value stays short (older entries use it); this is the wording shown on screen. */
export const CHECK_LABELS: Record<(typeof CHECKS)[number], string> = { Learned: "Learned something", "Made progress": "Made progress", Connected: "Spent time with people", Rested: "Rested", Moved: "Exercised or moved" }

export interface FormWording { title: string; mood: string; energy: string; checks: string; prompts: { key: "win" | "hard" | "grateful"; question: string }[]; notes: string; save: string }
const PERIOD_NOUN: Record<Period, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }
const PERIOD_PROMPTS: Record<Period, [string, string, string]> = {
  daily: ["What was one win today?", "What was hard today?", "What are you grateful for?"],
  weekly: ["What was the best part of this week?", "What got in the way?", "What is worth remembering?"],
  monthly: ["What progress did you make this month?", "What would you change?", "What is worth remembering?"],
  yearly: ["What grew this year?", "What was the hardest lesson?", "What mattered most?"],
}

/** The words the review form uses. Every question is optional. */
export function formWording(period: Period): FormWording {
  const noun = PERIOD_NOUN[period]
  const keys = ["win", "hard", "grateful"] as const
  return {
    title: period === "daily" ? "Earlier check-in" : `${period[0].toUpperCase()}${period.slice(1)} review`,
    mood: `How was your ${noun} overall?`, energy: `How was your energy this ${noun}?`, checks: `What happened this ${noun}? Tick any.`,
    prompts: PERIOD_PROMPTS[period].map((question, i) => ({ key: keys[i], question })), notes: "Anything else on your mind? (optional)", save: period === "daily" ? "Save check-in" : "Save review",
  }
}

/** Human-readable text, so the web and Mac apps can display a review without understanding this form. */
export function writeCheckIn(period: Period, form: CheckIn): string {
  const lines = [`## ${period[0].toUpperCase()}${period.slice(1)} check-in`]
  for (const [label, value] of [["Mood", form.mood], ["Energy", form.energy], ["Win", form.win], ["Hard", form.hard], ["Grateful", form.grateful]]) {
    if (value.trim()) lines.push(`${label}: ${value.trim().replace(/\s*\n\s*/g, " ")}`)
  }
  for (const label of CHECKS) if (form.checks.includes(label)) lines.push(`- [x] ${label}`)
  if (form.notes.trim()) lines.push("", "Notes:", form.notes.trim())
  return lines.join("\n")
}

export function readCheckIn(text: string): CheckIn {
  const form: CheckIn = { ...EMPTY_CHECK_IN, checks: [] }
  const [head, ...notes] = text.split("\nNotes:\n")
  for (const line of head.split("\n")) {
    const field = /^(Mood|Energy|Win|Hard|Grateful): (.*)$/.exec(line)
    if (field) {
      const key = field[1].toLowerCase() as "mood" | "energy" | "win" | "hard" | "grateful"
      form[key] = field[2]
    }
    const check = /^- \[x\] (.*)$/.exec(line)
    if (check && CHECKS.some(label => label === check[1])) form.checks.push(check[1])
  }
  form.notes = notes.join("\nNotes:\n")
  return form
}

export const hasCheckIn = (form: CheckIn): boolean => !!(form.mood || form.energy || form.win.trim() || form.hard.trim() || form.grateful.trim() || form.checks.length || form.notes.trim())

/** One line for the list: mood, energy, then the first thing written. Empty when nothing was filled in. */
export function checkInSummary(form: CheckIn): string {
  const text = [form.win, form.hard, form.grateful, form.notes].map(x => x.trim().replace(/\s+/g, " ")).find(Boolean)
  return [form.mood, form.energy && `${form.energy} energy`, form.checks.length ? `${form.checks.length} ticked` : "", text].filter(Boolean).join(" · ")
}

// ---------------------------------------------------------------------------------------------
// Morning, afternoon and evening check-ins: taps, not typing
// ---------------------------------------------------------------------------------------------

export type Slot = "morning" | "afternoon" | "evening"
export const SLOTS: readonly { key: Slot; label: string; blurb: string }[] = [
  { key: "morning", label: "Morning", blurb: "Set up the day" },
  { key: "afternoon", label: "Afternoon", blurb: "Check how it is going" },
  { key: "evening", label: "Evening", blurb: "Look back on the day" },
]
export const slotLabel = (slot: Slot): string => SLOTS.find(s => s.key === slot)?.label ?? slot

/** Which check-in is "now" by the clock: before noon, before 5 pm, otherwise evening. */
export const slotForHour = (hour: number): Slot => hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"

/**
 * scale: one tap from 1 to 5. pick: one choice from a list. tick: any number of choices. text: one optional line.
 * `fromTasks` fields offer today's open tasks as their choices (and are left out when there are none).
 */
export type FieldKind = "scale" | "pick" | "tick" | "text"
export interface FormField { id: string; /** Name in the saved text. */ label: string; question: string; kind: FieldKind; low?: string; high?: string; options?: readonly string[]; fromTasks?: boolean; placeholder?: string }
/** Answers by field id. A scale is "1" to "5", a pick is the choice, a tick joins its choices with ", ". */
export type Answers = Record<string, string>

export const SCALE_MAX = 5
const MOOD = (when: string): FormField => ({ id: "mood", label: "Mood", question: `How are you feeling this ${when}?`, kind: "scale", low: "Low", high: "Great" })
const ENERGY: FormField = { id: "energy", label: "Energy", question: "How is your energy?", kind: "scale", low: "Drained", high: "Energized" }
const NOTE: FormField = { id: "note", label: "Note", question: "Anything to add?", kind: "text", placeholder: "Optional, one line" }
const DONE: FormField = { id: "done", label: "Done", question: "What have you done today?", kind: "tick", options: ["Learned something", "Made progress", "Spent time with people", "Rested", "Exercised or moved"] }
const BLOCKERS = (id: string, question: string): FormField => ({ id, label: id === "slowing" ? "Slowing me down" : "In the way", question, kind: "tick", options: ["Distractions", "Tired", "Too many meetings", "Unclear next step", "Stuck on a problem", "Nothing"] })

const FORMS: Record<Slot, FormField[]> = {
  morning: [
    MOOD("morning"), ENERGY,
    { id: "sleep", label: "Sleep", question: "How did you sleep?", kind: "scale", low: "Poorly", high: "Great" },
    { id: "plan", label: "Plan", question: "What do you want to get done today?", kind: "tick", options: ["Learning", "Project work", "Planning or admin", "Exercise", "Rest", "Time with people"] },
    { id: "focus", label: "Top priority", question: "What is your top priority today?", kind: "pick", fromTasks: true },
    NOTE,
  ],
  afternoon: [
    MOOD("afternoon"), ENERGY,
    { id: "focusLevel", label: "Focus", question: "How focused are you?", kind: "scale", low: "Scattered", high: "Locked in" },
    { id: "pace", label: "Pace", question: "How is the day going?", kind: "pick", options: ["Ahead", "On track", "Behind"] },
    BLOCKERS("slowing", "What is slowing you down?"), DONE, NOTE,
  ],
  evening: [
    MOOD("evening"), ENERGY,
    { id: "overall", label: "Day", question: "How was today overall?", kind: "scale", low: "Rough", high: "Great" },
    { id: "stress", label: "Stress", question: "How stressed were you?", kind: "scale", low: "Calm", high: "Stressed" },
    { id: "goal", label: "Main thing", question: "Did you get your main thing done?", kind: "pick", options: ["Yes", "Partly", "No"] },
    DONE, BLOCKERS("blocked", "What got in the way?"),
    { id: "grateful", label: "Grateful for", question: "What are you grateful for?", kind: "tick", options: ["Health", "Friends or family", "Progress", "Time to rest", "Something that went well"] },
    NOTE,
  ],
}

/** The questions to show for a check-in. `tasks` are today's open task titles, offered on the morning priority question. */
export function slotForm(slot: Slot, tasks: readonly string[] = []): FormField[] {
  return FORMS[slot].flatMap(field => field.fromTasks ? (tasks.length ? [{ ...field, options: tasks }] : []) : [field])
}

export const hasAnswers = (a: Answers): boolean => Object.values(a).some(v => v.trim())

/** Saved as readable lines ("Mood: 4/5", "Plan: Learning, Exercise") so the web and Mac apps can show them. */
export function writeSlotCheckIn(slot: Slot, answers: Answers): string {
  const lines = [`## ${slotLabel(slot)} check-in`]
  for (const field of FORMS[slot]) {
    const value = (answers[field.id] ?? "").trim().replace(/\s*\n\s*/g, " ")
    if (value) lines.push(`${field.label}: ${field.kind === "scale" ? `${value}/${SCALE_MAX}` : value}`)
  }
  return lines.join("\n")
}

export function readSlotCheckIn(slot: Slot, text: string): Answers {
  const answers: Answers = {}
  for (const line of text.split("\n")) {
    const at = line.indexOf(": ")
    if (at < 1) continue
    const field = FORMS[slot].find(f => f.label === line.slice(0, at))
    if (!field) continue
    const raw = line.slice(at + 2).trim()
    const value = field.kind === "scale" ? /^([1-5])(?:\/5)?$/.exec(raw)?.[1] : raw
    if (value) answers[field.id] = value
  }
  return answers
}

/** One line for the list, for example "Mood 4/5 · Energy 3/5 · 2 ticked · Learning". */
export function slotSummary(slot: Slot, answers: Answers): string {
  const parts: string[] = []
  let ticked = 0
  for (const field of FORMS[slot]) {
    const value = (answers[field.id] ?? "").trim()
    if (!value) continue
    if (field.kind === "scale") parts.push(`${field.label} ${value}/${SCALE_MAX}`)
    else if (field.kind === "tick") ticked += value.split(", ").filter(Boolean).length
    else parts.push(value)
  }
  if (ticked) parts.splice(Math.min(parts.length, 2), 0, `${ticked} ticked`)
  return parts.join(" · ")
}

/** Toggle one choice in a tick answer. */
export function toggleTick(current: string | undefined, option: string): string {
  const items = (current ?? "").split(", ").filter(Boolean)
  return (items.includes(option) ? items.filter(x => x !== option) : [...items, option]).join(", ")
}
