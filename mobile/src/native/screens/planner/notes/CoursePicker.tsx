import { shape } from "../../../../shape.ts"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../../lib/shared.ts"
import { color } from "../../../../theme.ts"
import { Icon } from "../../../ui.tsx"
import { courseFor, courseOptions } from "./note-rules.ts"

/** The course a note links to: a row showing the choice that opens a short list (None first). */
export function CoursePicker({ courses, value, onChange }: { courses: Collections["courses"]; value?: string; onChange: (id: string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const current = courseFor(courses, value)
  const pick = (id: string | undefined) => (onChange(id), setOpen(false))
  return (
    <View style={styles.gap}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.field} accessibilityRole="button" accessibilityLabel={`Course, ${current ? current.title || current.label : value ? "unknown course" : "none"}`} accessibilityState={{ expanded: open }}>
        <Text style={current || value ? styles.value : styles.placeholder} numberOfLines={1}>
          {current ? `${current.label}  ${current.title}` : value ? "Course no longer exists" : "None"}
        </Text>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} tint={color.text2} />
      </Pressable>
      {open ? (
        <View style={styles.list}>
          <Option label="None" selected={!value} onPress={() => pick(undefined)} />
          {courseOptions(courses).map((c) => (
            <Option key={c.id} label={`${c.label}  ${c.title}`} selected={c.id === value} onPress={() => pick(c.id)} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected }}>
      <Text style={styles.value} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Icon name="checkmark" size={18} tint={color.text} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 6 },
  field: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.well, paddingHorizontal: 14 },
  list: { borderRadius: shape.card, borderWidth: 1, borderColor: color.edge, backgroundColor: color.well, overflow: "hidden" },
  option: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 14 },
  pressed: { backgroundColor: color.raised },
  value: { flex: 1, color: color.text, fontSize: 15 },
  placeholder: { flex: 1, color: color.faint, fontSize: 15 },
})

