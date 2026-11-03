import { Pressable, StyleSheet, Text } from "react-native"
import { plannerColor as c } from "../../planner-theme.ts"
export function PlannerChip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return <Pressable style={[styles.chip, active && styles.active]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}><Text style={[styles.text, active && { color: c.accent }]}>{label}</Text></Pressable>
}
const styles = StyleSheet.create({ chip: { minHeight: 32, paddingHorizontal: 12, justifyContent: "center", borderRadius: 18, backgroundColor: c.raised }, active: { backgroundColor: c.selected }, text: { fontSize: 12, color: c.text2 } })
