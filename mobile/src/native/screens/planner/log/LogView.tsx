import { shape } from "../../../../shape.ts"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../../lib/shared.ts"
import { plannerColor as color } from "../../../planner-theme.ts"
import { Icon, tone } from "../../../ui.tsx"
import { WorkspaceSection } from "../../../WorkspacePage.tsx"
import { selectedItem } from "../../../selected-item.ts"
import { DailyLogEditor } from "./DailyLogEditor.tsx"
import { LogLists } from "./LogLists.tsx"
import { dayTitle, recentDayItems, recentEntries, shiftDay, weekStrip } from "./log-rules.ts"
import type { LogDrafts } from "./useLogDrafts.ts"

/**
 * The Planner's Daily log on the real workspace: a day navigator, the week with a dot on the days
 * that have an entry, an inline composer with explicit Save entry, custom section tabs, the tasks done
 * and due that day, and the latest entries. Text stays in a draft until the workspace holds it.
 */
export function LogView({ data, today, logs, day, onDay: setDay, blocked, onEditTask, hideNav = false, intro, tint = color.accent }: { hideNav?: boolean; /** A line of explanation at the top of the Log panel. */ intro?: string; tint?: string; data: Collections; today: string; day: string; onDay: (day: string) => void; logs: LogDrafts; blocked?: string; onEditTask: (id: string) => void }) {
  const { drafts } = logs
  const recent = recentEntries(data.journal, drafts)
  const [recentDay, setRecentDay] = useState<string | null>(null)
  const [recentItem, setRecentItem] = useState<string | null>(null)

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

      <WorkspaceSection title="Log" icon="book-outline" tint={tint}>
        {intro ? <Text style={styles.intro}>{intro}</Text> : null}
        <DailyLogEditor data={data} day={day} logs={logs} blocked={blocked} embedded tint={tint} />
      </WorkspaceSection>

      <LogLists tasks={data.tasks} day={day} onEditTask={onEditTask} />

      <WorkspaceSection title="Recent entries" icon="time-outline" tint={tint} count={recent.length ? String(recent.length) : undefined} collapsible flush>
        {recent.length === 0 ? <Text style={[styles.intro, { color: tint }]}>No entries yet. Your dated entries appear here.</Text> : null}
        {recent.map((e) => <View key={e.day} style={[selectedItem.item, recentDay === e.day && selectedItem.itemOn]}>
          <Pressable onPress={() => { setRecentDay(current => current === e.day ? null : e.day); setRecentItem(null) }} style={({ pressed }) => [styles.recent, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ expanded: recentDay === e.day }} accessibilityLabel={`Preview entries for ${e.day}`}>
            <Text style={styles.recentDay}>{dayTitle(e.day, today)}</Text>
            <Text style={styles.recentText} numberOfLines={1}>
              {e.preview}
            </Text>
          </Pressable>
          {recentDay === e.day ? <View style={styles.recentDetails}>{recentDayItems(data.journal, drafts, e.day).map((item, index) => {
            const active = recentItem ? recentItem === `${e.day}/${item.id}` : index === 0
            return <View key={item.id}><Pressable onPress={() => setRecentItem(`${e.day}/${item.id}`)} style={[styles.recentChoice, active && { borderColor: tint, backgroundColor: color.selected }]} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`View ${item.label}`}><Text style={styles.choiceLabel}>{item.label}</Text><Text style={styles.recentText} numberOfLines={1}>{item.summary}</Text></Pressable>{active ? <Text style={styles.choiceText}>{item.text || "No text saved in this section yet."}</Text> : null}</View>
          })}</View> : null}
        </View>)}
      </WorkspaceSection>
    </View>
  )
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  nav: { flexDirection: "row", alignItems: "center", gap: 4 },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleBox: { flex: 1 },
  today: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, backgroundColor: color.panel, borderWidth: 1, borderColor: color.line },
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
  intro: { color: color.muted, fontSize: 12, lineHeight: 18, paddingVertical: 6 },
  recent: { minHeight: 52, justifyContent: "center", gap: 2, paddingVertical: 6, paddingHorizontal: 10 },
  recentDay: { color: color.text, fontSize: 14, fontWeight: "600" },
  recentText: { color: color.muted, fontSize: 13 },
  recentDetails: { paddingHorizontal: 10, paddingBottom: 10, gap: 4 }, recentChoice: { minHeight: 42, justifyContent: "center", gap: 2, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: color.line, borderRadius: 9 }, choiceLabel: { color: color.text, fontSize: 12, fontWeight: "600" }, choiceText: { color: color.text2, fontSize: 12, lineHeight: 18, paddingHorizontal: 9, paddingVertical: 7 },
  pressed: { backgroundColor: color.raised },
})

