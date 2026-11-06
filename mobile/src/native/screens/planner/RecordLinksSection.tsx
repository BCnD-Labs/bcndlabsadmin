import { TextInput } from "../../editing/keyboard.tsx"
import { useMemo, useState } from "react"
import { Pressable, Text, View } from "react-native"
import type { Collections } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { Chip, Icon, tone } from "../../ui.tsx"
import { LINK_KINDS, MAX_RECORD_LINKS, addRecordLink, describeLink, linkChoices, pickable, removeRecordLink, type LinkKind, type RecordLink } from "./record-links.ts"
import { TextAction, shared } from "./sheet-parts.tsx"

/**
 * Linked records: the notes, tasks and daily logs this task points at (shown by name, with a
 * "deleted" label if the target is gone), unlink with the x, and "Link existing" opens a picker
 * (type chips, search, tap to link) like the web's. Existing targets open through the owner screen after unsaved edits are handled.
 */
export function RecordLinksSection({ links, onChange, data, selfId, today, onOpen }: { links: RecordLink[]; onChange: (links: RecordLink[]) => void; data: Collections; selfId?: string; today: string; onOpen?: (link: RecordLink) => void }) {
  const [picking, setPicking] = useState(false)
  const [kind, setKind] = useState<LinkKind>("note")
  const [query, setQuery] = useState("")
  const choices = useMemo(() => pickable(linkChoices(kind, data, selfId, today), links, kind, query), [kind, data, selfId, today, links, query])
  const full = links.length >= MAX_RECORD_LINKS
  return (
    <>
      {links.length ? null : <Text style={shared.hint}>Connect notes, tasks, or a day's log.</Text>}
      {links.map((link) => {
        const v = describeLink(link, data)
        return (
          <View key={v.key} style={[shared.row, { minHeight: 44 }]}>
            <Pressable style={{ flex: 1 }} disabled={v.missing || !onOpen} onPress={() => onOpen?.(link)} accessibilityRole="button" accessibilityLabel={`Open ${v.label}`}><Text style={[shared.value, v.missing && { color: color.faint }]} numberOfLines={2}>
              {v.label}{!v.missing && onOpen ? "  ›" : ""}
            </Text></Pressable>
            <Pressable onPress={() => onChange(removeRecordLink(links, link))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel={`Unlink ${v.label}`}>
              <Icon name="close" size={20} tint={color.text2} />
            </Pressable>
          </View>
        )
      })}
      {full ? <Text style={shared.hint}>{`That's the most a task can link (${MAX_RECORD_LINKS}).`}</Text> : <TextAction label={picking ? "Done linking" : "Link existing"} onPress={() => setPicking((v) => !v)} />}
      {picking && !full ? (
        <View style={{ gap: 8 }}>
          <View style={shared.chips}>
            {LINK_KINDS.map((k) => (
              <Chip key={k.kind} label={k.label} active={kind === k.kind} onPress={() => (setKind(k.kind), setQuery(""))} />
            ))}
          </View>
          {kind !== "log" ? <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${kind === "note" ? "notes" : "tasks"}`} placeholderTextColor={color.faint} accessibilityLabel="Search records to link" autoCorrect={false} style={shared.input} /> : null}
          {choices.length ? (
            choices.map((c) => (
              <Pressable key={c.id} onPress={() => onChange(addRecordLink(links, kind, c.id))} style={[shared.row, { minHeight: 44 }]} accessibilityRole="button" accessibilityLabel={`Link ${c.title}`}>
                <Icon name="add-circle-outline" size={20} tint={tone.blue} />
                <Text style={[shared.value, { flex: 1 }]} numberOfLines={1}>
                  {c.title}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={shared.hint}>{query.trim() ? "Nothing matches." : "Nothing left to link."}</Text>
          )}
        </View>
      ) : null}
    </>
  )
}

