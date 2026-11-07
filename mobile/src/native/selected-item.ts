import { StyleSheet } from "react-native"
import { plannerColor as c } from "./planner-theme.ts"

/** The selected row treatment used by Home, shared by the other native lists. */
export const selectedItem = StyleSheet.create({
  item: { borderBottomWidth: 1, borderColor: c.line, borderLeftWidth: 3, borderLeftColor: "transparent" },
  itemOn: { backgroundColor: c.selected, borderLeftColor: c.accent, paddingRight: 6 },
})
