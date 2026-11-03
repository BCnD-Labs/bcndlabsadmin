import { useEffect, useSyncExternalStore } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { tone } from "../ui.tsx"
import { dismissSnack, getSnack, runSnackAction, subscribeSnack } from "./snack-store.ts"

/** Where the snackbar sits: above the nav row (16 + 56 + 12), left of the Planner's "+" (16 + 56 + 12 from the right). */
const BOTTOM = 84
const RIGHT = 84

/**
 * Draws the current snackbar (see snack-store.ts) and removes it after its time. Mount once, near the
 * root of the native shell. A polite live region, so TalkBack reads each message when it appears.
 */
export function SnackHost() {
  const snack = useSyncExternalStore(subscribeSnack, getSnack, getSnack)
  const id = snack?.id
  const ms = snack?.ms
  useEffect(() => {
    if (id === undefined || ms === undefined) return
    const timer = setTimeout(() => dismissSnack(id), ms)
    return () => clearTimeout(timer)
  }, [id, ms])
  if (!snack) return null
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite" pointerEvents="box-none">
      <Text style={styles.text} numberOfLines={2}>
        {snack.text}
      </Text>
      {snack.action ? (
        <Pressable onPress={() => void runSnackAction(snack)} style={styles.action} accessibilityRole="button" accessibilityLabel={snack.action.label}>
          <Text style={styles.actionText}>{snack.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 16, right: RIGHT, bottom: BOTTOM, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 14, borderRadius: 12, backgroundColor: color.selected, borderWidth: 1, borderColor: color.border, elevation: 8 },
  text: { flex: 1, color: color.text, fontSize: 14, paddingVertical: 10 },
  action: { minWidth: 64, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  actionText: { color: tone.blue, fontSize: 14, fontWeight: "700" },
})
