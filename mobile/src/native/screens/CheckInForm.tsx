import { Pressable, StyleSheet, Text, View } from "react-native"
import { shape } from "../../shape.ts"
import { mono } from "../../theme.ts"
import { TextInput } from "../editing/keyboard.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { SCALE_MAX, toggleTick, type Answers, type FormField } from "./journal-review.ts"

/**
 * The morning, afternoon and evening questions. Almost everything is a tap: a 1 to 5 scale, a pick from a list,
 * or ticks. The only typing is one optional line at the end.
 */
export function CheckInForm({ fields, answers, onChange }: { fields: FormField[]; answers: Answers; onChange: (id: string, value: string) => void }) {
  return <>{fields.map(field => <View key={field.id} style={s.field}>
    <View style={s.head}><Text style={s.question}>{field.question}</Text><Text style={s.hint}>{field.kind === "scale" || field.kind === "pick" ? "PICK ONE" : field.kind === "tick" ? "PICK ANY" : "OPTIONAL"}</Text></View>
    {field.kind === "scale" ? <Scale field={field} value={answers[field.id]} onChange={v => onChange(field.id, v)} /> : null}
    {field.kind === "pick" ? <Choices field={field} selected={answers[field.id] ? [answers[field.id]] : []} onPress={option => onChange(field.id, answers[field.id] === option ? "" : option)} /> : null}
    {field.kind === "tick" ? <Choices field={field} multi selected={(answers[field.id] ?? "").split(", ").filter(Boolean)} onPress={option => onChange(field.id, toggleTick(answers[field.id], option))} /> : null}
    {field.kind === "text" ? <TextInput value={answers[field.id] ?? ""} onChangeText={v => onChange(field.id, v.replace(/\n/g, " "))} placeholder={field.placeholder} placeholderTextColor={c.muted} style={s.input} accessibilityLabel={field.question} maxLength={200} returnKeyType="done" /> : null}
  </View>)}</>
}

/** Five numbered buttons; tapping the selected one clears it. */
function Scale({ field, value, onChange }: { field: FormField; value?: string; onChange: (value: string) => void }) {
  return <View>
    <View style={s.scale} accessibilityRole="radiogroup">{Array.from({ length: SCALE_MAX }, (_, i) => String(i + 1)).map(n => {
      const on = value === n
      return <Pressable key={n} onPress={() => onChange(on ? "" : n)} style={[s.step, on && s.stepOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${field.question} ${n} of ${SCALE_MAX}${n === "1" ? `, ${field.low}` : n === String(SCALE_MAX) ? `, ${field.high}` : ""}`}><Text style={[s.stepText, on && s.stepTextOn]}>{n}</Text></Pressable>
    })}</View>
    <View style={s.ends} accessible={false} importantForAccessibility="no-hide-descendants"><Text style={s.endText}>1 · {field.low}</Text><Text style={s.endText}>{field.high} · {SCALE_MAX}</Text></View>
  </View>
}

function Choices({ field, selected, multi, onPress }: { field: FormField; selected: string[]; multi?: boolean; onPress: (option: string) => void }) {
  // A saved choice that is no longer on offer (for example a finished task) stays visible so it can be cleared.
  const options = [...(field.options ?? []), ...selected.filter(x => !(field.options ?? []).includes(x))]
  return <View style={s.choices}>{options.map(option => {
    const on = selected.includes(option)
    return <Pressable key={option} onPress={() => onPress(option)} style={[s.choice, on && s.choiceOn]} accessibilityRole={multi ? "checkbox" : "radio"} accessibilityState={{ checked: on }}>
      {multi ? <Icon name={on ? "checkbox" : "square-outline"} size={15} tint={on ? c.accent : c.muted} /> : null}
      <Text style={[s.choiceText, on && s.choiceTextOn]} numberOfLines={1}>{option}</Text>
    </Pressable>
  })}</View>
}

const s = StyleSheet.create({
  field: { gap: 7 }, head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }, question: { flex: 1, color: c.text, fontSize: 13, fontWeight: "600" }, hint: { color: c.muted, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.8 },
  scale: { flexDirection: "row", gap: 6 }, step: { flex: 1, height: 40, borderRadius: shape.card, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, stepOn: { backgroundColor: c.selected, borderColor: c.accent }, stepText: { color: c.text2, fontSize: 15, fontWeight: "600" }, stepTextOn: { color: c.accent, fontWeight: "700" },
  ends: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 }, endText: { color: c.muted, fontFamily: mono, fontSize: 9.5 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, choice: { minHeight: 34, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, borderRadius: 17, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, choiceOn: { backgroundColor: c.selected, borderColor: c.accent }, choiceText: { flexShrink: 1, color: c.text2, fontSize: 12.5 }, choiceTextOn: { color: c.accent, fontWeight: "600" },
  input: { color: c.text, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 40, fontSize: 13 },
})
