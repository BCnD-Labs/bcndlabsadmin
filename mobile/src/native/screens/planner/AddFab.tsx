import { useEffect, useState } from "react"
import { Keyboard, Pressable, StyleSheet } from "react-native"
import { color } from "../../../theme.ts"
import { Icon } from "../../ui.tsx"

/** 16dp edge + 56dp nav bubble + 12dp gap: the "+" floats above the nav row, so it never covers the bubble or its expanded bar. */
export const FAB_BOTTOM = 84
export const FAB_SIZE = 56

/**
 * The floating "+" (new task). Sits at the bottom right, above the floating nav's row whichever
 * side the nav bubble is on. Hidden while the keyboard is up (like the nav). When adding is not
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
      style={({ pressed }) => [styles.fab, !enabled && styles.off, pressed && enabled && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="New task"
      accessibilityState={{ disabled: !enabled }}
    >
      <Icon name="add" size={30} tint="#fff" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: { position: "absolute", right: 16, bottom: FAB_BOTTOM, width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: color.red, elevation: 6 },
  pressed: { backgroundColor: color.redPressed },
  off: { opacity: 0.4 },
})
