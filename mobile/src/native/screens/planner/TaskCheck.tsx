import { Pressable, StyleSheet, View } from "react-native"
import { plannerColor as color } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"

/**
 * A circular checkbox with a 44px default target. The compact calendar agenda opts into a 32px
 * target; other lists retain their existing touch area.
 */
export function TaskCheck({ checked, onPress, label, compact = false }: { checked: boolean; onPress: () => void; label: string; compact?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.target, compact && styles.compactTarget]} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }}>
      <View style={[styles.box, compact && styles.compactBox, checked && styles.on]}>{checked ? <Icon name="checkmark" size={compact ? 13 : 16} tint="#fff" /> : null}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  target: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  compactTarget: { width: 32, minHeight: 32 }, compactBox: { width: 18, height: 18, borderRadius: 9 },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#777984", alignItems: "center", justifyContent: "center" },
  on: { backgroundColor: color.accent, borderColor: color.accent },
})
