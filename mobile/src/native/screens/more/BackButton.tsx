import { Pressable, StyleSheet, Text } from "react-native"
import { color } from "../../../theme.ts"
import { Icon } from "../../ui.tsx"

/** The "Back" control at the top of a More sub-view (44px tall). */
export function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={styles.back} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name="chevron-back" size={20} tint={color.text2} />
      <Text style={styles.text}>Back</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, minHeight: 44, paddingHorizontal: 4 },
  text: { color: color.text2, fontSize: 15, fontWeight: "600" },
})
