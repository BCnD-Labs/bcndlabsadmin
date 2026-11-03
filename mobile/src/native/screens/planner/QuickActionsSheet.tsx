import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { tone } from "../../ui.tsx"
import type { QuickAction, QuickKey } from "./quick-actions.ts"

/**
 * The long-press menu for one task: a small bottom sheet of plain actions (see quick-actions.ts).
 * Mount it only while open. Picking an action closes it and hands the key to the screen.
 */
export function QuickActionsSheet({ title, actions, onPick, onClose }: { title: string; actions: QuickAction[]; onPick: (key: QuickKey) => void; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          {actions.map((a) => (
            <Pressable key={a.key} onPress={() => onPick(a.key)} style={({ pressed }) => [styles.action, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={a.label}>
              <Text style={[styles.label, a.destructive && styles.destructive]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: color.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: color.edge, paddingBottom: 16 },
  title: { color: color.muted, fontSize: 13, fontWeight: "700", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  action: { minHeight: 52, justifyContent: "center", paddingHorizontal: 20 },
  pressed: { backgroundColor: color.raised },
  label: { color: color.text, fontSize: 16 },
  destructive: { color: tone.red, fontWeight: "700" },
})
