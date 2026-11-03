import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { tone } from "../ui.tsx"
import { ConflictSheet } from "./ConflictSheet.tsx"
import { syncChip } from "./sync-view.ts"
import { useWorkspace } from "./WorkspaceProvider.tsx"

const TINT = { green: tone.green, amber: tone.amber, red: tone.red, grey: tone.grey } as const

/**
 * The sync status chip for a screen's title row. It only reports what the data layer knows
 * (see syncChip). A tap does the useful thing: sign-in opens Settings (Account), a conflict opens
 * the conflict sheet, offline or a sync problem tries again.
 */
export function SyncStatus({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { status, pending, pendingCount, conflict, refresh } = useWorkspace()
  const [sheet, setSheet] = useState(false)
  const chip = syncChip(status, pending, pendingCount)
  const tint = TINT[chip.tint]
  const press = chip.target === "settings" ? onOpenSettings : chip.target === "conflict" ? () => setSheet(true) : chip.target === "refresh" ? () => void refresh() : undefined

  const body = (
    <View style={[styles.chip, { borderColor: tint }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={styles.text} numberOfLines={1}>
        {chip.label}
      </Text>
    </View>
  )
  return (
    <>
      {press ? (
        <Pressable onPress={press} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${chip.label}. ${chip.target === "settings" ? "Opens Settings" : chip.target === "conflict" ? "Opens the conflict" : "Tries again"}`}>
          {body}
        </Pressable>
      ) : (
        <View accessibilityLabel={chip.label}>{body}</View>
      )}
      {conflict ? <ConflictSheet visible={sheet} conflict={conflict} onClose={() => setSheet(false)} /> : null}
    </>
  )
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 190, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: color.well },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: color.text2, fontSize: 12, fontWeight: "600", flexShrink: 1 },
})
