import { useState, type ReactNode } from "react"
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { plannerColor as c } from "../../../planner-theme.ts"
const color = { ...c, edge: c.line }
import { Icon } from "../../../ui.tsx"
import { useReduceMotion } from "../../../nav/useReduceMotion.ts"

/**
 * A bottom sheet in an RN Modal, the same look as the task editor's: grabber, title, close button and a
 * scrolling body. `onBackdrop` runs when the dimmed area is tapped (the editor ignores it while there are unsaved edits).
 */
export function SheetFrame({ title, onClose, onBackdrop, children, compact = false }: { title: string; onClose: () => void; onBackdrop?: () => void; children: ReactNode; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const reduceMotion = useReduceMotion()
  return (
    <Modal visible transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onBackdrop ?? onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, compact && styles.compactSheet, expanded && { maxHeight: "92%" }]} accessibilityViewIsModal>
          <View style={[styles.header, compact && styles.compactHeader]}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable onPress={() => setExpanded(v => !v)} style={[styles.close, compact && styles.compactClose]} accessibilityRole="button" accessibilityLabel={expanded ? "Compact note editor" : "Expand note editor"}><Icon name={expanded ? "contract-outline" : "expand-outline"} size={19} tint={c.accent} /></Pressable>
            <Pressable onPress={onClose} style={[styles.close, compact && styles.compactClose]} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} tint={color.text2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.body, compact && styles.compactBody]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { maxHeight: "78%", width: "100%", maxWidth: 560, backgroundColor: color.panel, borderRadius: 22, borderWidth: 1, borderColor: color.edge },
  compactSheet: { maxHeight: "65%", borderRadius: 17, borderColor: c.border },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: color.border },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 16, paddingRight: 4 },
  compactHeader: { paddingLeft: 12, paddingRight: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  title: { color: color.text, fontSize: 16, fontWeight: "700" },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  compactClose: { width: 32, height: 35 },
  body: { paddingHorizontal: 16, paddingBottom: 28, gap: 8 },
  compactBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
})
