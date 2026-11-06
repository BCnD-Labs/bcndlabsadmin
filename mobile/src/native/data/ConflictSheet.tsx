import { shape } from "../../shape.ts"
import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { Button } from "../ui.tsx"
import { conflictRows } from "./sync-view.ts"
import { useWorkspace, type ConflictInfo } from "./WorkspaceProvider.tsx"

/**
 * Shown when the same records changed here and on another device. Nothing is saved until one
 * side is chosen; the side not chosen is kept on the phone as a recovery copy (workspace client).
 */
export function ConflictSheet({ visible, conflict, onClose }: { visible: boolean; conflict: ConflictInfo; onClose: () => void }) {
  const { resolveConflict } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const rows = conflictRows(conflict.conflicts, conflict.mine, conflict.theirs)

  async function choose(choice: "mine" | "theirs") {
    setBusy(true)
    try {
      await resolveConflict(choice)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <Text style={styles.title} accessibilityRole="header">
          Changed in two places
        </Text>
        <Text style={styles.lead}>These were edited here and on another device. Nothing is saved until you choose. The version you don't keep is stored on this phone as a recovery copy.</Text>
        <ScrollView style={styles.list}>
          {rows.map((r) => (
            <Text key={r.key} style={styles.row}>
              {r.label}
            </Text>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          <Button label="Keep my version" primary onPress={() => !busy && void choose("mine")} />
          <Button label="Keep the server's version" onPress={() => !busy && void choose("theirs")} />
          <Button label="Decide later" onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "80%", backgroundColor: color.panel, borderTopLeftRadius: shape.dialog, borderTopRightRadius: shape.dialog, borderWidth: 1, borderColor: color.edge, padding: 16, paddingBottom: 28, gap: 12 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.border },
  title: { color: color.text, fontSize: 18, fontWeight: "700" },
  lead: { color: color.text2, fontSize: 13, lineHeight: 19 },
  list: { flexGrow: 0, maxHeight: 180, backgroundColor: color.well, borderRadius: shape.card, padding: 10 },
  row: { color: color.text, fontSize: 14, paddingVertical: 4 },
  actions: { gap: 8 },
})

