import { useRef, type ComponentRef } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Icon } from "../../ui.tsx"

/** Where the button sits in the window, so the popover can open right under it. */
export type Anchor = { x: number; y: number; width: number; height: number }

/** A small icon button for the course header row. A count badge shows only while a panel is on. */
export function PanelsButton({ count, onOpen }: { count: number; onOpen: (anchor: Anchor | null) => void }) {
  const ref = useRef<ComponentRef<typeof Pressable>>(null)
  const open = () => {
    const node = ref.current
    if (!node) return onOpen(null)
    node.measureInWindow((x, y, width, height) => onOpen(width > 0 || height > 0 ? { x, y, width, height } : null))
  }
  return (
    <Pressable
      ref={ref}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Choose panels"
      accessibilityHint={count > 0 ? `${count} on` : undefined}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name="options-outline" size={22} tint={color.text2} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: color.raised },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: color.red,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
})
