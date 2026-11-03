import { Pressable, StyleSheet, View } from "react-native"
import { color } from "../../../theme.ts"
import { Icon } from "../../ui.tsx"

/**
 * A checkbox with a 44px touch target. The shared Checkbox in ui.tsx draws a 24px box with an
 * 8px hit slop (40px), so the native screens use this one.
 */
export function TaskCheck({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={styles.target} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.on]}>{checked ? <Icon name="checkmark" size={16} tint="#fff" /> : null}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  target: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  on: { backgroundColor: color.red, borderColor: color.red },
})
