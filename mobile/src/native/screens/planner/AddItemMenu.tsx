import { shape } from "../../../shape.ts"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { plannerColor as c } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"
import { FAB_BOTTOM, FAB_SIZE } from "./AddFab.tsx"
export function AddItemMenu({ onChoose, onClose }: { onChoose: (kind: "task" | "event") => void; onClose: () => void }) {
  const inset = useSafeAreaInsets()
  return <View style={styles.fill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close create menu" />
      <View style={[styles.menu, { bottom: FAB_BOTTOM + FAB_SIZE + 8 + inset.bottom, right: 16 + inset.right }]} accessibilityViewIsModal>
        <Text style={styles.heading}>Create</Text>
        {(["task", "event"] as const).map(kind => <Pressable key={kind} style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.selected }]} onPress={() => onChoose(kind)} accessibilityRole="button" accessibilityLabel={`New ${kind}`}>
          <Icon name={kind === "task" ? "checkbox-outline" : "calendar-outline"} size={16} tint={c.accent} /><Text style={styles.label}>{kind === "task" ? "Task" : "Event"}</Text>
        </Pressable>)}
      </View>
    </View>
}
const styles = StyleSheet.create({
  fill: { flex: 1 }, menu: { position: "absolute", width: 140, borderRadius: shape.menu, padding: 4, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border, elevation: 12 },
  heading: { color: c.muted, fontSize: 10, textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 5 }, row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32, paddingHorizontal: 8, borderRadius: 8 }, label: { color: c.text, fontSize: 12 },
})

