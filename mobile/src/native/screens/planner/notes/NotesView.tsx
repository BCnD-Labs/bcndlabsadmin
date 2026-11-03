import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { togglePin, type Collections } from "../../../../lib/shared.ts"
import { color, notePaper } from "../../../../theme.ts"
import { useWorkspace } from "../../../data/WorkspaceProvider.tsx"
import { Button, Chip, ChipRow, Icon, SectionLabel } from "../../../ui.tsx"
import { resolveWithin } from "../task-form.ts"
import { NoteRow } from "./NoteRow.tsx"
import { NoteSheet, type NoteEditor } from "./NoteSheet.tsx"
import { NOTE_COLORS, colorCounts, courseFor, orderNotes, type NoteColor } from "./note-rules.ts"

/**
 * The Planner's Notes on the real workspace, like the web's list: pinned notes first, then the rest,
 * newest edit first. Search the text, filter by paper colour, pin from the row, tap a note to edit it
 * in a sheet, "+" for a new one. `blocked` is why changes are not possible right now (an open conflict).
 */
export function NotesView({ data, blocked }: { data: Collections; blocked?: string }) {
  const { mutate, message } = useWorkspace()
  const [search, setSearch] = useState("")
  const [colour, setColour] = useState<NoteColor | undefined>()
  const [editor, setEditor] = useState<NoteEditor | null>(null)
  const [notice, setNotice] = useState<string>()
  const now = new Date()
  const { pinned, others } = useMemo(() => orderNotes(data.notes, { search, color: colour }), [data.notes, search, colour])
  const counts = useMemo(() => colorCounts(data.notes), [data.notes])
  const total = data.notes.length
  const filtering = !!search.trim() || !!colour

  async function pin(id: string) {
    setNotice(undefined)
    const ok = await resolveWithin(mutate(["notes"], (d) => togglePin(d, id)), 1500, true)
    if (!ok) setNotice(message ?? "That couldn't be saved.")
  }

  const rows = (notes: typeof pinned) =>
    notes.map((n) => <NoteRow key={n.id} note={n} course={courseFor(data.courses, n.courseId)} now={now} onOpen={() => setEditor({ mode: "edit", id: n.id })} onPin={() => (blocked ? setNotice(blocked) : void pin(n.id))} />)

  return (
    <View style={styles.gap}>
      <View style={styles.head}>
        <Text style={styles.count}>{`${total} note${total === 1 ? "" : "s"}`}</Text>
        <Pressable onPress={() => (blocked ? setNotice(blocked) : setEditor({ mode: "create" }))} style={[styles.add, !!blocked && styles.off]} accessibilityRole="button" accessibilityLabel="New note" accessibilityState={{ disabled: !!blocked }}>
          <Icon name="add" size={22} tint={color.text} />
        </Pressable>
      </View>

      {total > 0 ? (
        <>
          <View style={styles.search}>
            <Icon name="search" size={18} tint={color.faint} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search notes" placeholderTextColor={color.faint} accessibilityLabel="Search notes" autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <Icon name="close-circle" size={18} tint={color.faint} />
              </Pressable>
            ) : null}
          </View>
          <ChipRow>
            <Chip label="All colours" active={!colour} onPress={() => setColour(undefined)} />
            {NOTE_COLORS.filter((c) => counts[c.value] > 0 || colour === c.value).map((c) => (
              <Chip key={c.value} label={`${c.label} · ${counts[c.value]}`} dot={notePaper[c.value]} active={colour === c.value} onPress={() => setColour(colour === c.value ? undefined : c.value)} />
            ))}
          </ChipRow>
        </>
      ) : null}

      {notice || blocked ? <Text style={styles.error}>{notice ?? blocked}</Text> : null}

      {total === 0 ? (
        <View style={styles.empty}>
          <Icon name="document-text-outline" size={32} tint={color.faint} />
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptyText}>Jot something down. Pinned notes also show on Home.</Text>
          <Button label="Add a note" primary onPress={() => (blocked ? setNotice(blocked) : setEditor({ mode: "create" }))} />
        </View>
      ) : pinned.length + others.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No notes match</Text>
          <Text style={styles.emptyText}>{filtering ? "Try a different search or colour." : ""}</Text>
        </View>
      ) : (
        <>
          {pinned.length ? <SectionLabel>{`Pinned · ${pinned.length}`}</SectionLabel> : null}
          {rows(pinned)}
          {others.length ? <SectionLabel>{`${pinned.length ? "Others" : "All notes"} · ${others.length}`}</SectionLabel> : null}
          {rows(others)}
        </>
      )}
      {editor ? <NoteSheet editor={editor} data={data} onClose={() => setEditor(null)} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { color: color.muted, fontSize: 13, fontWeight: "600" },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: color.red },
  off: { opacity: 0.45 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.well, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: color.text, fontSize: 15, paddingVertical: 8 },
  error: { color: color.errorText, fontSize: 13 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 28 },
  emptyTitle: { color: color.text, fontSize: 16, fontWeight: "700" },
  emptyText: { color: color.muted, fontSize: 13, textAlign: "center", marginBottom: 4 },
})
