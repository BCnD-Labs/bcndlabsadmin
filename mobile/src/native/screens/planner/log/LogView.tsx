import { useRef, useState, type ComponentRef } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { Collections } from "../../../../lib/shared.ts"
import { color } from "../../../../theme.ts"
import { Chip, ChipRow, Empty, Icon, SectionLabel, tone } from "../../../ui.tsx"
import { LogLists } from "./LogLists.tsx"
import { LOG_PROMPTS, SAVE_LABEL, appendPrompt, dayTitle, recentEntries, saveState, shiftDay, shownText, weekStrip } from "./log-rules.ts"
import type { LogDrafts } from "./useLogDrafts.ts"

/**
 * The Planner's Daily log on the real workspace: a day navigator, the week with a dot on the days
 * that have an entry, the day's entry (saves as you type), the web's prompt chips, the tasks done
 * and due that day, and the latest entries. Text stays in a draft until the workspace holds it.
 */
export function LogView({ data, today, logs, blocked, onEditTask }: { data: Collections; today: string; logs: LogDrafts; blocked?: string; onEditTask: (id: string) => void }) {
  const [day, setDay] = useState(today)
  const [caret, setCaret] = useState<number | null>(null)
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const { drafts, saving, failed, edit, save } = logs
  const text = shownText(drafts, data.journal, day)
  const state = saveState(day, data.journal, drafts, saving, failed)
  const recent = recentEntries(data.journal, drafts)

  function prompt(label: string) {
    const next = appendPrompt(text, label)
    edit(day, next, true)
    setCaret(next.length)
    input.current?.focus()
  }

  return (
    <View style={styles.gap}>
      <View style={styles.nav}>
        <Pressable onPress={() => setDay(shiftDay(day, -1))} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Previous day">
          <Icon name="chevron-back" size={22} tint={color.text2} />
        </Pressable>
        <View style={styles.titleBox}>
          <Text style={styles.title} accessibilityRole="header">
            {dayTitle(day, today)}
          </Text>
        </View>
        <Pressable onPress={() => setDay(shiftDay(day, 1))} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Next day">
          <Icon name="chevron-forward" size={22} tint={color.text2} />
        </Pressable>
        <Chip label="Today" active={day === today} onPress={() => setDay(today)} />
      </View>

      <View style={styles.week} accessibilityLabel="This week">
        {weekStrip(day, today, data.journal, drafts).map((d) => (
          <Pressable key={d.key} onPress={() => setDay(d.key)} style={[styles.cell, d.selected && styles.cellOn, d.today && !d.selected && styles.cellToday]} accessibilityRole="button" accessibilityState={{ selected: d.selected }} accessibilityLabel={`${d.weekday} ${d.num}${d.has ? ", has an entry" : ""}`}>
            <Text style={[styles.weekday, d.selected && styles.onRed]}>{d.weekday}</Text>
            <Text style={[styles.num, d.selected && styles.onRed]}>{d.num}</Text>
            <View style={[styles.dot, d.has && { backgroundColor: d.selected ? color.text : tone.green }]} />
          </Pressable>
        ))}
      </View>

      <ChipRow>
        {LOG_PROMPTS.map((p) => (
          <Chip key={p} label={`+ ${p}`} onPress={() => prompt(p)} />
        ))}
      </ChipRow>
      <TextInput
        ref={input}
        value={text}
        onChangeText={(t) => edit(day, t)}
        onBlur={() => day in drafts && void save(day)}
        selection={caret === null ? undefined : { start: caret, end: caret }}
        onSelectionChange={() => caret !== null && setCaret(null)}
        multiline
        textAlignVertical="top"
        placeholder="What happened? A few lines are enough."
        placeholderTextColor={color.faint}
        accessibilityLabel={`Daily log for ${day}`}
        style={styles.entry}
      />
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Text style={[styles.statusText, state === "failed" && styles.bad]}>{SAVE_LABEL[state]}</Text>
        {state === "failed" || state === "unsaved" ? (
          <Pressable onPress={() => void save(day)} style={styles.retry} accessibilityRole="button" accessibilityLabel={state === "failed" ? "Try saving again" : "Save now"}>
            <Text style={styles.retryText}>{state === "failed" ? "Try again" : "Save now"}</Text>
          </Pressable>
        ) : null}
      </View>
      {state === "failed" && blocked ? <Text style={styles.bad}>{blocked}</Text> : null}

      <LogLists tasks={data.tasks} day={day} onEditTask={onEditTask} />

      <SectionLabel>Recent entries</SectionLabel>
      {recent.length === 0 ? <Empty>No entries yet. What you write above shows up here, and on the web.</Empty> : null}
      {recent.map((e) => (
        <Pressable key={e.day} onPress={() => setDay(e.day)} style={({ pressed }) => [styles.recent, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open the log for ${e.day}`}>
          <Text style={styles.recentDay}>{dayTitle(e.day, today)}</Text>
          <Text style={styles.recentText} numberOfLines={1}>
            {e.preview}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  nav: { flexDirection: "row", alignItems: "center", gap: 4 },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleBox: { flex: 1 },
  title: { color: color.text, fontSize: 17, fontWeight: "700" },
  week: { flexDirection: "row", gap: 6 },
  cell: { flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 12, borderWidth: 1, borderColor: color.edge, backgroundColor: color.panel },
  cellOn: { backgroundColor: color.red, borderColor: color.red },
  cellToday: { borderColor: color.border },
  weekday: { color: color.muted, fontSize: 11, fontWeight: "600" },
  num: { color: color.text, fontSize: 16, fontWeight: "700" },
  onRed: { color: color.text },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
  entry: { minHeight: 200, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.well, color: color.text, padding: 14, fontSize: 15, lineHeight: 23 },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 },
  statusText: { color: color.muted, fontSize: 12 },
  bad: { color: color.errorText, fontSize: 13 },
  retry: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: color.border, justifyContent: "center" },
  retryText: { color: color.text, fontSize: 13, fontWeight: "700" },
  recent: { minHeight: 52, justifyContent: "center", gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.line },
  recentDay: { color: color.text, fontSize: 14, fontWeight: "600" },
  recentText: { color: color.muted, fontSize: 13 },
  pressed: { backgroundColor: color.raised },
})
