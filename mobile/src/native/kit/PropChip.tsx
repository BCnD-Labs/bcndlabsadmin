import { StyleSheet, Text, View } from "react-native"
import { mono } from "../../theme.ts"
import { chipTone, kit, type ChipKind } from "./tokens.ts"

/**
 * A labelled property: a small KEY on a darker half and its value on the tone for that kind
 * (`DUE Today 18:00`, `COURSE Networking`). Without a label it is a plain tag, for table columns whose
 * header already names the property.
 */
export function PropChip({ kind, label, value }: { kind: ChipKind; label?: string; value: string }) {
  const tone = chipTone[kind]
  return (
    <View style={[s.chip, { backgroundColor: tone.fill }]} accessible accessibilityLabel={label ? `${label}: ${value}` : value}>
      {label ? <Text style={s.key} numberOfLines={1}>{label.toUpperCase()}</Text> : null}
      <Text style={[s.value, { color: tone.ink }]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", maxWidth: "100%", minHeight: 20, borderRadius: 5, overflow: "hidden" },
  key: { alignSelf: "stretch", textAlignVertical: "center", paddingHorizontal: 5, backgroundColor: "rgba(0,0,0,0.34)", color: kit.mutedInk, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.6, paddingTop: 4 },
  value: { flexShrink: 1, paddingHorizontal: 6, fontSize: 10.5, lineHeight: 14, paddingVertical: 3 },
})
