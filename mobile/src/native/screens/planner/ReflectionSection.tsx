import { TextInput } from "../../editing/keyboard.tsx"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Chip, Icon } from "../../ui.tsx"
import { REFLECTION_KEYS, addItem, isOwnValue, reflectionLabel, reflectionOptions, removeItem, setItem, type ReflectionDraft, type ReflectionKey } from "./reflection.ts"
import { shared } from "./sheet-parts.tsx"

/**
 * The reflection editor, like the web's: "How did it go?" free text, plus optional items
 * (difficulty, time spent, help used, outcome, next time, what I learned, what got in the way).
 * An item with choices shows them as chips with "Write my own" for anything else. It is optional
 * and never changes whether the task is done.
 */
export function ReflectionSection({ value, onChange, error }: { value: ReflectionDraft; onChange: (r: ReflectionDraft) => void; error?: string }) {
  // Items switched to free text this session (so an empty box stays a box).
  const [own, setOwn] = useState<Set<ReflectionKey>>(new Set())
  const present = REFLECTION_KEYS.filter((k) => k in value.items)
  const missing = REFLECTION_KEYS.filter((k) => !(k in value.items))
  return (
    <>
      <Text style={shared.label}>How did it go?</Text>
      <TextInput value={value.text} onChangeText={(text) => onChange({ ...value, text })} placeholder="A quick note is enough. What happened, what helped, or what would you change?" placeholderTextColor={color.faint} accessibilityLabel="How did it go?" multiline style={[shared.input, shared.multi]} />
      {present.map((key) => {
        const v = value.items[key] ?? ""
        const free = own.has(key) || isOwnValue(key, v)
        return (
          <View key={key} style={{ gap: 6 }}>
            <View style={shared.row}>
              <Text style={[shared.label, { flex: 1 }]}>{reflectionLabel(key)}</Text>
              <Pressable onPress={() => onChange(removeItem(value, key))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel={`Remove ${reflectionLabel(key)}`}>
                <Icon name="close" size={18} tint={color.text2} />
              </Pressable>
            </View>
            {free ? (
              <TextInput value={v} onChangeText={(t) => onChange(setItem(value, key, t))} placeholder={key === "timeSpent" ? "e.g. 42 min" : "Write a short note"} placeholderTextColor={color.faint} accessibilityLabel={reflectionLabel(key)} multiline={!reflectionOptions(key).length} style={shared.input} />
            ) : (
              <View style={shared.chips}>
                {reflectionOptions(key).map((o) => (
                  <Chip key={o} label={o} active={v === o} onPress={() => onChange(setItem(value, key, o))} />
                ))}
                <Chip label="Write my own" onPress={() => setOwn((s) => new Set(s).add(key))} />
              </View>
            )}
          </View>
        )
      })}
      {missing.length ? <Text style={shared.label}>Add an item</Text> : null}
      <View style={shared.chips}>
        {missing.map((k) => (
          <Chip key={k} label={`+ ${reflectionLabel(k)}`} onPress={() => onChange(addItem(value, k))} />
        ))}
      </View>
      {error ? <Text style={shared.error}>{error}</Text> : null}
    </>
  )
}

