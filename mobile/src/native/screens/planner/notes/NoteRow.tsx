import { Pressable, StyleSheet, Text, View } from "react-native"
import { color, notePaper } from "../../../../theme.ts"
import { Icon } from "../../../ui.tsx"
import { colorOf, noteTitle, notePreview, shortAgo, type CourseOption, type Note } from "./note-rules.ts"

/**
 * One note as a line: paper-colour dot, first line, a one-line preview, its course and age. A tap opens
 * it; the pin button on the right pins or unpins it (pinned notes also show on Home, as on the web).
 */
export function NoteRow({ note, course, now, onOpen, onPin, compact = false }: { note: Note; course?: CourseOption; now: Date; onOpen: () => void; onPin: () => void; compact?: boolean }) {
  const title = noteTitle(note.text)
  const preview = notePreview(note.text)
  const meta = [course?.label, shortAgo(note.updatedAt, now), note.links?.length ? `${note.links.length} link${note.links.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")
  return (
    <View style={styles.row}>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.body, compact && styles.compactBody, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${title}${note.pinned ? ", pinned" : ""}. Open note`}>
        <View style={[styles.dot, { backgroundColor: notePaper[colorOf(note.color)] }]} />
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
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: color.line },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  compactBody: { minHeight: 44, paddingVertical: 4, gap: 8 },
  pressed: { backgroundColor: color.raised },
  dot: { width: 12, height: 12, borderRadius: 6 },
  text: { flex: 1, gap: 2 },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  compactTitle: { fontSize: 14 },
  preview: { color: color.muted, fontSize: 13 },
  compactPreview: { fontSize: 12 },
  meta: { color: color.faint, fontSize: 11 },
  pin: { width: 44, minHeight: 56, alignItems: "center", justifyContent: "center" },
  compactPin: { minHeight: 44 },
})
