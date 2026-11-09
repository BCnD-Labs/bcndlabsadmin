import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { TextInput } from "../../editing/keyboard.tsx"
import { defaultMakeId, type Collections } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { plannerColor as p } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"

type Topic = NonNullable<Collections["courses"][number]["topics"]>[number]

/** Units, modules or chapters, in order. Several lines pasted at once become several topics. */
export function TopicsEditor({ value, onChange }: { value: Topic[]; onChange: (next: Topic[]) => void }) {
  const [text, setText] = useState("")
  const add = () => {
    const titles = text.split("\n").map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean)
    if (!titles.length) return
    onChange([...value, ...titles.map(title => ({ id: defaultMakeId("tpc"), title: title.slice(0, 200) }))].slice(0, 80))
    setText("")
  }
  return <View style={s.wrap}>
    <Text style={s.label}>Modules</Text>
    {value.map(t => <View key={t.id} style={s.row}>
      <TextInput style={[s.input, s.grow]} value={t.title} onChangeText={title => onChange(value.map(x => x.id === t.id ? { ...x, title } : x))} accessibilityLabel="Module" maxLength={200} placeholderTextColor={color.muted} />
      <Pressable onPress={() => onChange(value.filter(x => x.id !== t.id))} style={s.trash} accessibilityRole="button" accessibilityLabel={`Remove ${t.title}`}><Icon name="trash-outline" size={17} tint={p.muted} /></Pressable>
    </View>)}
    <View style={s.row}>
      <TextInput style={[s.input, s.grow]} value={text} onChangeText={setText} onSubmitEditing={add} multiline placeholder="Add a module, e.g. Module 5: Energy markets" placeholderTextColor={color.muted} accessibilityLabel="New module" />
      <Pressable onPress={add} disabled={!text.trim()} style={[s.add, !text.trim() && s.off]} accessibilityRole="button" accessibilityLabel="Add module"><Text style={s.addText}>Add</Text></Pressable>
    </View>
  </View>
}

const s = StyleSheet.create({
  wrap: { gap: 6 }, label: { color: color.muted, fontSize: 11 }, row: { flexDirection: "row", alignItems: "center", gap: 6 }, grow: { flex: 1 },
  input: { minHeight: 34, borderRadius: 12, borderWidth: 1, borderColor: p.line, backgroundColor: p.ground, color: p.text, paddingHorizontal: 10, paddingVertical: 5, fontSize: 13 },
  trash: { width: 32, height: 32, alignItems: "center", justifyContent: "center" }, add: { minHeight: 34, paddingHorizontal: 12, borderRadius: 12, justifyContent: "center", backgroundColor: p.raised }, off: { opacity: 0.45 }, addText: { color: p.accent, fontSize: 12, fontWeight: "600" },
})
