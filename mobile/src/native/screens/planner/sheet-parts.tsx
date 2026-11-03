import type { ReactNode } from "react"
import { Pressable, StyleSheet, Switch, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Icon, tone } from "../../ui.tsx"

/** Small building blocks shared by the task editor's sections (plain React Native, theme tokens only). */

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={shared.value}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ false: color.border, true: color.red }} thumbColor={color.text} />
    </View>
  )
}

/** A collapsible group of fields with a one-line summary while it is closed. A warning icon marks a section holding an error. */
export function Section({ title, summary, open, onToggle, error, children }: { title: string; summary: string; open: boolean; onToggle: () => void; error?: boolean; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.head} accessibilityRole="button" accessibilityLabel={`${title}, ${summary}`} accessibilityState={{ expanded: open }}>
        <View style={styles.headText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {open ? null : (
            <Text style={styles.summary} numberOfLines={1}>
              {summary}
            </Text>
          )}
        </View>
        {error ? <Icon name="alert-circle" size={20} tint={tone.red} /> : null}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} tint={color.text2} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  )
}

/** A small outlined text button (used inside sections for Add / Clear). */
export function TextAction({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.actionText, danger && { color: tone.red }]}>{label}</Text>
    </Pressable>
  )
}

export const shared = StyleSheet.create({
  label: { color: color.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.well, color: color.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, justifyContent: "center" },
  multi: { minHeight: 88, textAlignVertical: "top" },
  value: { color: color.text, fontSize: 15 },
  placeholder: { color: color.faint, fontSize: 15 },
  error: { color: color.errorText, fontSize: 13 },
  hint: { color: color.muted, fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  section: { borderRadius: 12, borderWidth: 1, borderColor: color.edge, backgroundColor: color.ground },
  head: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 14 },
  headText: { flex: 1, gap: 1 },
  sectionTitle: { color: color.text, fontSize: 15, fontWeight: "700" },
  summary: { color: color.muted, fontSize: 12 },
  body: { gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  action: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, alignSelf: "flex-start" },
  actionText: { color: color.text, fontSize: 14, fontWeight: "700" },
})
