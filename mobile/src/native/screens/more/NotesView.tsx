import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Chip, ChipRow, Empty, Icon } from "../../ui.tsx"
import { SAMPLE_NOTES, type SampleNote } from "../../sample.ts"

type Filter = "all" | "pinned"

/** Note cards from the sample set, filtered by All or Pinned. Nothing is saved. */
export function NotesView() {
  const [filter, setFilter] = useState<Filter>("all")
  const shown = SAMPLE_NOTES.filter((n) => filter === "all" || n.pinned)
  return (
    <>
      <ChipRow>
        <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label="Pinned" active={filter === "pinned"} onPress={() => setFilter("pinned")} />
      </ChipRow>
      {shown.length === 0 ? <Empty>No pinned notes.</Empty> : null}
      {shown.map((n) => (
        <NoteCard key={n.id} note={n} />
      ))}
    </>
  )
}

function NoteCard({ note }: { note: SampleNote }) {
  return (
    <View style={styles.note}>
      <View style={[styles.bar, { backgroundColor: note.color }]} />
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>
            {note.title}
          </Text>
          {note.pinned ? (
            <View accessibilityLabel="Pinned">
              <Icon name="pin" size={16} />
            </View>
          ) : null}
        </View>
        <Text style={styles.preview}>{note.preview}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  note: { flexDirection: "row", overflow: "hidden", backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge },
  bar: { width: 5 },
  body: { flex: 1, padding: 14, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: color.text, fontSize: 15, fontWeight: "700" },
  preview: { color: color.muted, fontSize: 13, lineHeight: 18 },
})
