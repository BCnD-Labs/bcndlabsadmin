import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"
import { validDateKey } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { Icon } from "../../ui.tsx"
import { PlannerChip as Chip } from "./PlannerChip.tsx"
import { DatePicker } from "./DatePicker.tsx"
import { formatDay } from "./dates.ts"
import { TextAction, ToggleRow, shared } from "./sheet-parts.tsx"
import { DURATIONS, type ExtraErrors, type Extras } from "./task-extras.ts"

/**
 * The web's "Calendar schedule" plus the daily focus: a planned date and start time and a duration
 * (they move the task on the Calendar without changing its deadline), and "Focus today". Focus is
 * stored as the day it applies to, so a focus set for another day is shown and can be cleared.
 */
export function ScheduleSection({ x, set, today, errors, event = false }: { x: Extras; set: (p: Partial<Extras>) => void; today: string; errors: ExtraErrors; event?: boolean }) {
  const [picker, setPicker] = useState(false)
  const planned = validDateKey(x.scheduledDate)
  const custom = x.duration && !DURATIONS.includes(Number(x.duration))
  const otherFocus = x.focusDate && x.focusDate !== today
  return (
    <>
      <Text style={shared.hint}>{event ? "Choose the event date. Add a start time for a timed event, or leave it blank for all day." : "Plan time here without changing the deadline."}</Text>
      <Text style={shared.label}>{event ? "Event date" : "Planned date"}</Text>
      <Pressable onPress={() => setPicker((v) => !v)} style={shared.input} accessibilityRole="button" accessibilityLabel={`Planned date, ${planned ? formatDay(x.scheduledDate) : "none"}`} accessibilityState={{ expanded: picker }}>
        <View style={shared.dateRow}>
          <Text style={planned ? shared.value : shared.placeholder}>{planned ? formatDay(x.scheduledDate) : event ? "Choose a date" : "Not planned (uses the due date)"}</Text>
          <Icon name={picker ? "chevron-up" : "chevron-down"} size={18} tint={color.text2} />
        </View>
      </Pressable>
      {picker ? <DatePicker value={x.scheduledDate} today={today} onChange={(scheduledDate) => set(scheduledDate ? { scheduledDate } : { scheduledDate, scheduledTime: "" })} /> : null}
      {x.scheduledDate ? (
        <>
          <Text style={shared.label}>Start time (optional)</Text>
          <TextInput value={x.scheduledTime} onChangeText={(scheduledTime) => set({ scheduledTime })} placeholder="HH:mm, like 18:30" placeholderTextColor={color.faint} accessibilityLabel="Start time" keyboardType="numbers-and-punctuation" maxLength={5} style={shared.input} />
        </>
      ) : null}
      {errors.schedule ? <Text style={shared.error}>{errors.schedule}</Text> : null}
      <Text style={shared.label}>Duration</Text>
      <View style={shared.chips}>
        <Chip label="None" active={!x.duration} onPress={() => set({ duration: "" })} />
        {custom ? <Chip label={`${x.duration} min`} active onPress={() => undefined} /> : null}
        {DURATIONS.map((m) => (
          <Chip key={m} label={`${m} min`} active={x.duration === String(m)} onPress={() => set({ duration: String(m) })} />
        ))}
      </View>
      {errors.duration ? <Text style={shared.error}>{errors.duration}</Text> : null}
      {x.scheduledDate || x.duration ? <TextAction label="Clear schedule" onPress={() => set({ scheduledDate: "", scheduledTime: "", duration: "" })} /> : null}
      {!event ? <ToggleRow label="Focus today" value={x.focusDate === today} onChange={(on) => set({ focusDate: on ? today : "" })} /> : null}
      {!event && otherFocus ? (
        <View style={shared.row}>
          <Text style={[shared.hint, { flex: 1 }]}>{validDateKey(x.focusDate) ? `Focus day is ${formatDay(x.focusDate)}.` : "Focus day is not a valid date."}</Text>
          <TextAction label="Clear focus" onPress={() => set({ focusDate: "" })} />
        </View>
      ) : null}
    </>
  )
}
