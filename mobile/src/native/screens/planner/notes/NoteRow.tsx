import { Pressable, StyleSheet, Text, View } from "react-native"
import { color, noteInk, notePaper } from "../../../../theme.ts"
import { Icon } from "../../../ui.tsx"
import { colorOf, noteTitle, notePreview, shortAgo, type CourseOption, type Note } from "./note-rules.ts"
import { selectedItem } from "../../../selected-item.ts"
import { previewText } from "../TaskPeek.tsx"
import { plannerColor as p } from "../../../planner-theme.ts"

/**
 * One note as a line: paper-colour document tile, first line, a one-line preview, its course and age. A tap opens
 * its read-only details; the pin button on the right pins or unpins it.
 */
export function NoteRow({ note, course, now, onOpen, onSelect, onPin, expanded = false, compact = false }: { note: Note; course?: CourseOption; now: Date; onOpen: () => void; onSelect: () => void; onPin: () => void; expanded?: boolean; compact?: boolean }) {
  const title = noteTitle(note.text)
  const preview = notePreview(note.text)
  const meta = [course?.label, shortAgo(note.updatedAt, now), note.links?.length ? `${note.links.length} link${note.links.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")
  return (
    <View style={[selectedItem.item, expanded && selectedItem.itemOn]}>
    <View style={styles.row}>
      <Pressable onPress={onSelect} style={({ pressed }) => [styles.body, compact && styles.compactBody, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${title}${note.pinned ? ", pinned" : ""}. ${expanded ? "Hide preview" : "Preview note"}`} accessibilityState={{ expanded }}>
        <View style={[styles.noteIcon, { backgroundColor: notePaper[colorOf(note.color)] }]}><Icon name="document-text-outline" size={14} tint={noteInk} /></View>
        <View style={styles.text}>
          <Text style={[styles.title, compact && styles.compactTitle]} numberOfLines={1}>
            {title}
          </Text>
          {preview ? (
            <Text style={[styles.preview, compact && styles.compactPreview]} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
      </Pressable>
      <Pressable onPress={onPin} style={[styles.pin, compact && styles.compactPin]} accessibilityRole="button" accessibilityLabel={note.pinned ? `Unpin ${title}` : `Pin ${title}`} accessibilityState={{ selected: note.pinned }}>
        <Icon name={note.pinned ? "pin" : "pin-outline"} size={20} tint={note.pinned ? color.text : color.faint} />
      </Pressable>
    </View>
    {expanded ? <View style={selectedItem.preview}>
      {notePreview(note.text) ? <Text style={styles.detailText} numberOfLines={2} ellipsizeMode="tail">{previewText(notePreview(note.text))}</Text> : <Text style={styles.detailText}>No additional text.</Text>}
      <Text style={styles.meta}>{[course?.title, note.links?.length ? `${note.links.length} linked ${note.links.length === 1 ? "item" : "items"}` : undefined].filter(Boolean).join(" · ")}</Text>
      <Pressable onPress={onOpen} style={selectedItem.action} accessibilityRole="button" accessibilityLabel={`Open ${title}`}><Icon name="open-outline" size={14} tint={p.accent} /><Text style={selectedItem.actionText}>Open</Text></Pressable>
    </View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  detailText: { color: p.text2, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center" },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  compactBody: { minHeight: 44, paddingVertical: 4, gap: 8 },
  pressed: { backgroundColor: color.raised },
  noteIcon: { width: 22, height: 24, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  compactTitle: { fontSize: 14 },
  preview: { color: color.muted, fontSize: 13 },
  compactPreview: { fontSize: 12 },
  meta: { color: p.muted, fontSize: 11 },
  pin: { width: 44, minHeight: 56, alignItems: "center", justifyContent: "center" },
  compactPin: { minHeight: 44 },
})

