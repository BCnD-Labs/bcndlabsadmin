import { useState } from "react"
import { Pressable, StyleSheet, Switch, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Card, Empty, ListRow } from "../../ui.tsx"
import type { CourseworkType, SampleCoursework } from "../../sample.ts"
import { shortDate } from "./dates.ts"

const PANELS: { type: CourseworkType; label: string }[] = [
  { type: "assignment", label: "Assignments" },
  { type: "exam", label: "Exams" },
  { type: "milestone", label: "Milestones" },
  { type: "event", label: "Events" },
]

/** Four switches, all off by default. Each one that is on adds a list of that type below. */
export function PanelsCard({ items, isDone }: { items: SampleCoursework[]; isDone: (w: SampleCoursework) => boolean }) {
  const [on, setOn] = useState<Record<CourseworkType, boolean>>({ assignment: false, exam: false, milestone: false, event: false })
  const flip = (type: CourseworkType) => setOn((s) => ({ ...s, [type]: !s[type] }))
  return (
    <>
      <Card title="Panels">
        {PANELS.map((p) => {
          const count = items.filter((w) => w.type === p.type).length
          return (
            <Pressable
              key={p.type}
              onPress={() => flip(p.type)}
              accessibilityRole="switch"
              accessibilityLabel={`Show ${p.label} panel`}
              accessibilityState={{ checked: on[p.type] }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.text}>
                <Text style={styles.title}>{p.label}</Text>
                <Text style={styles.sub}>{`${count} in this course`}</Text>
              </View>
              <Switch
                value={on[p.type]}
                onValueChange={() => flip(p.type)}
                accessibilityLabel={`${p.label} panel switch`}
                trackColor={{ false: color.border, true: color.red }}
                thumbColor="#ffffff"
              />
            </Pressable>
          )
        })}
      </Card>
      {PANELS.filter((p) => on[p.type]).map((p) => {
        const list = items.filter((w) => w.type === p.type).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
        return (
          <Card key={p.type} title={p.label}>
            {list.length === 0 ? <Empty>{`No ${p.label.toLowerCase()} in this course.`}</Empty> : null}
            {list.map((w) => (
              <ListRow key={w.id} title={w.title} subtitle={`Due ${shortDate(w.due)}${isDone(w) ? " · Done" : ""}`} done={isDone(w)} />
            ))}
          </Card>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  pressed: { opacity: 0.7 },
  text: { flex: 1 },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  sub: { color: color.muted, fontSize: 12, marginTop: 2 },
})
