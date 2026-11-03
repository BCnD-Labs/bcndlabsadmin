import type { ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../theme.ts"

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
  section: { gap: 8 },
  sectionTitle: { color: color.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  card: { backgroundColor: color.panel, borderColor: color.edge, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  block: { padding: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: color.line },
  row: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: color.line },
  rowPressed: { backgroundColor: color.raised },
  rowLabel: { color: color.text, fontSize: 15 },
  rowHint: { color: color.muted, fontSize: 12, marginTop: 2 },
  destructive: { color: color.errorText },
  disabled: { opacity: 0.5 },
})
