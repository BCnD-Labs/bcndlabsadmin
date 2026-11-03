import { Modal, Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from "react-native"
import { color } from "../../../theme.ts"
import type { CourseworkType, SampleCoursework } from "../../sample.ts"
import type { Anchor } from "./PanelsButton.tsx"
import { PANELS, panelCount, type PanelState } from "./panels.ts"

const WIDTH = 280
const MARGIN = 16
const FALLBACK_TOP = 120

/** A compact popover under the header button: four switches and a Done button. Outside tap or back closes it. */
export function PanelsPopover({
  visible,
  anchor,
  items,
  on,
  onToggle,
  onClose,
}: {
  visible: boolean
  anchor: Anchor | null
  items: SampleCoursework[]
  on: PanelState
  onToggle: (type: CourseworkType) => void
  onClose: () => void
}) {
  const { width: windowWidth } = useWindowDimensions()
  const width = Math.min(WIDTH, windowWidth * 0.9)
  const top = anchor ? anchor.y + anchor.height + 4 : FALLBACK_TOP
  const right = anchor ? Math.max(MARGIN / 2, windowWidth - (anchor.x + anchor.width)) : MARGIN
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close panels" accessibilityRole="button" />
      <View style={[styles.card, { width, top, right }]} accessibilityViewIsModal>
        <Text style={styles.heading} accessibilityRole="header">
          Panels
        </Text>
        {PANELS.map((p) => (
          <Pressable
            key={p.type}
            onPress={() => onToggle(p.type)}
            accessibilityRole="switch"
            accessibilityLabel={`Show ${p.label} panel`}
            accessibilityState={{ checked: on[p.type] }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.text}>
              <Text style={styles.title}>{p.label}</Text>
              <Text style={styles.sub}>{`${panelCount(items, p.type)} in this course`}</Text>
            </View>
            <Switch
              value={on[p.type]}
              onValueChange={() => onToggle(p.type)}
              accessibilityLabel={`${p.label} panel switch`}
              trackColor={{ false: color.border, true: color.red }}
              thumbColor="#ffffff"
            />
          </Pressable>
        ))}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" style={({ pressed }) => [styles.done, pressed && styles.donePressed]}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  card: {
    position: "absolute",
    backgroundColor: color.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.edge,
    padding: 14,
    gap: 8,
    elevation: 8,
  },
  heading: { color: color.text, fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  pressed: { opacity: 0.7 },
  text: { flex: 1 },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  sub: { color: color.muted, fontSize: 12, marginTop: 2 },
  done: { minHeight: 48, borderRadius: 12, backgroundColor: color.red, alignItems: "center", justifyContent: "center", marginTop: 4 },
  donePressed: { backgroundColor: color.redPressed },
  doneText: { color: "#fff", fontSize: 15, fontWeight: "700" },
})
