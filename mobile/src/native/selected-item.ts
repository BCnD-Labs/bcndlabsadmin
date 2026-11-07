import { StyleSheet } from "react-native"
import { plannerColor as c } from "./planner-theme.ts"

/** The selected row treatment used by Home, shared by the other native lists. */
export const selectedItem = StyleSheet.create({
  item: { borderBottomWidth: 1, borderColor: c.line, borderLeftWidth: 3, borderLeftColor: "transparent" },
  itemOn: { backgroundColor: c.selected, borderLeftColor: c.accent, paddingRight: 6 },
  preview: { paddingLeft: 36, paddingRight: 10, paddingTop: 2, paddingBottom: 8, gap: 6 },
  action: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.panel },
  actionText: { color: c.accent, fontSize: 12, fontWeight: "600" },
})
