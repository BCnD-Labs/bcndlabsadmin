import type { ReactNode } from "react"
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { color } from "../../../../theme.ts"
import { Icon } from "../../../ui.tsx"

/**
 * A bottom sheet in an RN Modal, the same look as the task editor's: grabber, title, close button and a
 * scrolling body. `onBackdrop` runs when the dimmed area is tapped (the editor ignores it while there are unsaved edits).
 */
export function SheetFrame({ title, onClose, onBackdrop, children }: { title: string; onClose: () => void; onBackdrop?: () => void; children: ReactNode }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onBackdrop ?? onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} tint={color.text2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { maxHeight: "92%", backgroundColor: color.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: color.edge },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: color.border },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 16, paddingRight: 4 },
  title: { color: color.text, fontSize: 18, fontWeight: "700" },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingBottom: 28, gap: 8 },
})
