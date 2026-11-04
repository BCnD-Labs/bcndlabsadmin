import type { ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../theme.ts"
import { plannerColor as c } from "../native/planner-theme.ts"

/** The Settings building blocks, shared by the Settings screen and its sections. */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={rowStyles.section}>
      <Text style={rowStyles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={rowStyles.card}>{children}</View>
    </View>
  )
}

export function Row({ label, hint, onPress, destructive, disabled }: { label: string; hint?: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.rowPressed, disabled && rowStyles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={hint}
    >
      <Text style={[rowStyles.rowLabel, destructive && rowStyles.destructive]}>{label}</Text>
      {hint ? <Text style={rowStyles.rowHint}>{hint}</Text> : null}
    </Pressable>
  )
}

export const rowStyles = StyleSheet.create({
  section: { gap: 4 },
  sectionTitle: { color: c.accent, fontSize: 10, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  card: { backgroundColor: c.panel, borderBottomWidth: 1, borderColor: c.line },
  block: { paddingHorizontal: 8, paddingVertical: 8, gap: 5, borderBottomWidth: 1, borderBottomColor: c.line },
  row: { minHeight: 38, paddingHorizontal: 8, paddingVertical: 6, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: c.line },
  rowPressed: { backgroundColor: color.raised },
  rowLabel: { color: c.text, fontSize: 13 },
  rowHint: { color: c.muted, fontSize: 11, marginTop: 2 },
  destructive: { color: color.errorText },
  disabled: { opacity: 0.5 },
})
