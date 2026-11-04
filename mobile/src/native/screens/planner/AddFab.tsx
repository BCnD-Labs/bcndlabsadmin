import { useEffect, useState } from "react"
import { Keyboard, Pressable, StyleSheet } from "react-native"
import { plannerColor as c } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"

/** Above the floating navigation capsule. The button is small (36dp); its touch area is padded out to 44dp. */
export const FAB_BOTTOM = 84
export const FAB_SIZE = 36

/**
 * The floating "+" (new task). Sits at the bottom right, above the floating navigation capsule.
 * Hidden while the keyboard is up (like the nav). When adding is not
 * possible it stays visible but dimmed and does nothing.
 */
export function AddFab({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  const [keyboard, setKeyboard] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  if (keyboard) return null
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      hitSlop={4}
      style={({ pressed }) => [styles.fab, !enabled && styles.off, pressed && enabled && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="New task or event"
      accessibilityState={{ disabled: !enabled }}
    >
      <Icon name="add" size={21} tint="#fff" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: { position: "absolute", right: 16, bottom: FAB_BOTTOM, width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: c.action, elevation: 6 },
  pressed: { backgroundColor: c.actionPressed },
  off: { opacity: 0.4 },
})
