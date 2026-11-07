import { shape } from "../../../../shape.ts"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../../lib/shared.ts"
import { plannerColor as color } from "../../../planner-theme.ts"
import { Empty, Icon, SectionLabel, tone } from "../../../ui.tsx"
import { DailyLogEditor } from "./DailyLogEditor.tsx"
import { LogLists } from "./LogLists.tsx"
import { dayTitle, recentEntries, shiftDay, weekStrip } from "./log-rules.ts"
import type { LogDrafts } from "./useLogDrafts.ts"

/**
 * The Planner's Daily log on the real workspace: a day navigator, the week with a dot on the days
 * that have an entry, an inline composer with explicit Save entry, custom section tabs, the tasks done
 * and due that day, and the latest entries. Text stays in a draft until the workspace holds it.
 */
export function LogView({ data, today, logs, day, onDay: setDay, blocked, onEditTask, hideNav = false, heading }: { hideNav?: boolean; heading?: string; data: Collections; today: string; day: string; onDay: (day: string) => void; logs: LogDrafts; blocked?: string; onEditTask: (id: string) => void }) {
  const { drafts } = logs
  const recent = recentEntries(data.journal, drafts)

  return (
    <View style={styles.gap}>
      {hideNav ? null : <View style={styles.nav}>
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
        <Pressable onPress={() => setDay(today)} style={[styles.today, day === today && styles.cellOn]} accessibilityRole="button" accessibilityLabel="Today"><Text style={styles.todayText}>Today</Text></Pressable>
      </View>}

      <View style={styles.week} accessibilityLabel="This week">
        {weekStrip(day, today, data.journal, drafts).map((d) => (
          <Pressable key={d.key} onPress={() => setDay(d.key)} style={[styles.cell, d.selected && styles.cellOn, d.today && !d.selected && styles.cellToday]} accessibilityRole="button" accessibilityState={{ selected: d.selected }} accessibilityLabel={`${d.weekday} ${d.num}${d.has ? ", has an entry" : ""}`}>
            <Text style={[styles.weekday, d.selected && styles.onSelected]}>{d.weekday}</Text>
            <Text style={[styles.num, d.selected && styles.onSelected]}>{d.num}</Text>
            <View style={[styles.dot, d.has && { backgroundColor: d.selected ? color.text : tone.green }]} />
          </Pressable>
        ))}
      </View>

      <DailyLogEditor data={data} day={day} logs={logs} blocked={blocked} heading={heading} />

      <LogLists tasks={data.tasks} day={day} onEditTask={onEditTask} />

      <SectionLabel>Recent entries</SectionLabel>
      {recent.length === 0 ? <Empty>No entries yet. Your dated entries appear here.</Empty> : null}
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
  today: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, backgroundColor: color.panel },
  todayText: { color: color.accent, fontSize: 12, fontWeight: "600" },
  title: { color: color.text, fontSize: 17, fontWeight: "700" },
  week: { flexDirection: "row", gap: 6 },
  cell: { flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: shape.card, borderWidth: 1, borderColor: color.line, backgroundColor: color.panel },
  cellOn: { backgroundColor: color.selected, borderColor: color.selected },
  cellToday: { borderColor: color.border },
  weekday: { color: color.muted, fontSize: 11, fontWeight: "600" },
  num: { color: color.text, fontSize: 16, fontWeight: "700" },
  onSelected: { color: color.text },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
  recent: { minHeight: 52, justifyContent: "center", gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.line },
  recentDay: { color: color.text, fontSize: 14, fontWeight: "600" },
  recentText: { color: color.muted, fontSize: 13 },
  pressed: { backgroundColor: color.raised },
})

