import { useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { shape } from "../../shape.ts"
import { KeyboardFrame, KeyboardScrollView, TextInput } from "../editing/keyboard.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { SCALE_MAX, toggleTick, type Answers, type FormField, type Slot } from "./journal-review.ts"
import { formatDay } from "./planner/dates.ts"

/** The compact New task dialog pattern, with one check-in property open at a time. */
export function CompactCheckIn({ slot, day, fields, answers, onChange, onSave, onClose, saving, blocked, error }: {
  slot: Slot; day: string; fields: FormField[]; answers: Answers; onChange: (id: string, value: string) => void
  onSave: () => void; onClose: () => void; saving: boolean; blocked?: string; error?: string | null
}) {
  const [active, setActive] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const note = fields.find(field => field.kind === "text")
  const optional = fields.filter(field => field.kind !== "scale" && field.kind !== "text")
  const shown = fields.filter(field => field.kind === "scale" || (field.kind !== "text" && (added.includes(field.id) || !!answers[field.id])))
  const selected = fields.find(field => field.id === active)
  const canSave = Object.values(answers).some(value => value.trim()) && !blocked && !saving

  function choose(field: FormField, value: string) {
    onChange(field.id, value)
    if (field.kind !== "tick") setActive(null)
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <KeyboardFrame style={s.frame}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close check-in" />
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}>
          <View style={s.heading}><Text style={s.title}>{slot[0].toUpperCase() + slot.slice(1)} check-in</Text><Text style={s.date}>{formatDay(day)}</Text></View>
          <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close check-in"><Icon name="close" size={20} tint={c.muted} /></Pressable>
        </View>
        <KeyboardScrollView style={s.scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.properties}>
            {shown.map(field => <Pressable key={field.id} onPress={() => setActive(current => current === field.id ? null : field.id)}
              style={[s.property, active === field.id && s.propertyOn]} accessibilityRole="button" accessibilityState={{ expanded: active === field.id }} accessibilityLabel={`${field.label}, ${answers[field.id] || "not set"}`}>
              <Text style={s.propertyText} numberOfLines={1}>{field.label}{answers[field.id] ? ` · ${answers[field.id]}` : " +"}</Text>
            </Pressable>)}
            <Pressable onPress={() => setActive(current => current === "more" ? null : "more")} style={s.more} accessibilityRole="button" accessibilityState={{ expanded: active === "more" }}><Text style={s.propertyText}>+ More</Text></Pressable>
          </View>
          {active === "more" ? <View style={s.choices}>{optional.filter(field => !shown.includes(field)).map(field => <Pressable key={field.id} onPress={() => { setAdded(current => [...current, field.id]); setActive(field.id) }} style={s.choice} accessibilityRole="button"><Text style={s.choiceText}>+ {field.label}</Text></Pressable>)}{optional.every(field => shown.includes(field)) ? <Text style={s.date}>All options added</Text> : null}</View> : null}
          {selected ? <View style={s.editor}>
            <Text style={s.question}>{selected.question}</Text>
            <View style={[s.choices, selected.kind === "scale" && s.scale]} accessibilityRole={selected.kind === "scale" ? "radiogroup" : undefined}>
              {(selected.kind === "scale" ? Array.from({ length: SCALE_MAX }, (_, i) => String(i + 1)) : [...(selected.options ?? []), ...(selected.kind === "pick" ? [answers[selected.id]] : (answers[selected.id] ?? "").split(", ")).filter((value): value is string => !!value && !(selected.options ?? []).includes(value))]).map(value => {
                const checked = selected.kind === "tick" ? (answers[selected.id] ?? "").split(", ").includes(value) : answers[selected.id] === value
                return <Pressable key={value} onPress={() => choose(selected, selected.kind === "tick" ? toggleTick(answers[selected.id], value) : checked ? "" : value)} style={[s.choice, selected.kind === "scale" && s.scaleChoice, checked && s.choiceOn]} accessibilityRole={selected.kind === "tick" ? "checkbox" : "radio"} accessibilityState={{ checked }} accessibilityLabel={selected.kind === "scale" ? `${selected.label} ${value} of ${SCALE_MAX}` : value}><Text style={[s.choiceText, checked && s.choiceTextOn]} numberOfLines={1}>{value}</Text></Pressable>
              })}
            </View>
            {selected.kind === "scale" ? <View style={s.ends}><Text style={s.endText}>1 · {selected.low}</Text><Text style={s.endText}>{selected.high} · 5</Text></View> : null}
            {selected.kind === "tick" ? <Pressable onPress={() => setActive(null)} style={s.done} accessibilityRole="button"><Text style={s.doneText}>Done</Text></Pressable> : null}
          </View> : null}
          {note ? <TextInput value={answers[note.id] ?? ""} onChangeText={value => onChange(note.id, value.replace(/\n/g, " "))} placeholder="Add a note or thought…" placeholderTextColor={c.muted} accessibilityLabel={note.question} maxLength={200} multiline textAlignVertical="top" style={s.note} /> : null}
          {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        </KeyboardScrollView>
        <View style={s.footer}>
          <Pressable onPress={onClose} style={s.cancel} accessibilityRole="button"><Text style={s.cancelText}>Close</Text></Pressable>
          <Pressable onPress={onSave} disabled={!canSave} style={[s.save, !canSave && s.disabled]} accessibilityRole="button" accessibilityState={{ disabled: !canSave }}><Icon name="checkmark" size={14} tint="#fff" /><Text style={s.saveText}>{saving ? "Saving…" : "Save check-in"}</Text></Pressable>
        </View>
      </View>
    </KeyboardFrame>
  </Modal>
}

const s = StyleSheet.create({
  frame: { flex: 1, justifyContent: "center", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.48)" },
  sheet: { width: "92%", maxWidth: 560, maxHeight: "62%", backgroundColor: c.panel, borderRadius: shape.dialog, borderWidth: 1, borderColor: c.border, overflow: "hidden", elevation: 18, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  header: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 14, paddingRight: 8, paddingVertical: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  heading: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }, title: { color: c.text, fontSize: 17, fontWeight: "600", flexShrink: 1 }, date: { color: c.muted, fontSize: 11 }, close: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  scroll: { flexGrow: 0, flexShrink: 1 }, body: { paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  properties: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 6 },
  property: { minHeight: 32, maxWidth: "100%", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.raised }, propertyOn: { backgroundColor: c.selected },
  propertyText: { color: c.text2, fontSize: 12 }, more: { minHeight: 32, justifyContent: "center", paddingHorizontal: 8, borderRadius: 16 },
  editor: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: 8 }, question: { color: c.text2, fontSize: 12 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, scale: { flexWrap: "nowrap" },
  choice: { minHeight: 32, maxWidth: "100%", justifyContent: "center", paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.raised }, scaleChoice: { flex: 1, alignItems: "center", paddingHorizontal: 0 }, choiceOn: { backgroundColor: c.selected }, choiceText: { color: c.text2, fontSize: 12 }, choiceTextOn: { color: c.accent },
  ends: { flexDirection: "row", justifyContent: "space-between" }, endText: { color: c.muted, fontSize: 10 }, done: { alignSelf: "flex-end", paddingHorizontal: 10, minHeight: 30, justifyContent: "center" }, doneText: { color: c.accent, fontSize: 12 },
  note: { minHeight: 54, maxHeight: 110, paddingTop: 10, paddingBottom: 8, color: c.text, fontSize: 13, lineHeight: 19, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  footer: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.panel },
  cancel: { minHeight: 32, paddingHorizontal: 10, justifyContent: "center", borderRadius: 16, backgroundColor: c.raised }, cancelText: { color: c.muted, fontSize: 12 },
  save: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.action }, saveText: { color: "#fff", fontSize: 12, fontWeight: "600" }, disabled: { opacity: 0.45 }, error: { color: "#ffa8a8", fontSize: 11 },
})
