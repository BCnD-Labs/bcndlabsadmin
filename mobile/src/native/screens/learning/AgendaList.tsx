import { StyleSheet, View } from "react-native"
import { Badge, Checkbox, Empty, Icon, ListRow, SectionLabel, TYPE_ICON, TYPE_LABEL, TYPE_TONE } from "../../ui.tsx"
import { SAMPLE_TODAY, type CourseworkType, type SampleCoursework } from "../../sample.ts"
import { AGENDA_ORDER, GROUP_LABEL, groupAgenda } from "./agenda.ts"
import { shortDate } from "./dates.ts"

/**
 * The course agenda. Under "All" empty groups are hidden. Under a type filter every group is
 * shown, and an empty one says so.
 */
export function AgendaList({
  items,
  filter,
  isDone,
  onToggle,
}: {
  items: SampleCoursework[]
  filter: CourseworkType | "all"
  isDone: (w: SampleCoursework) => boolean
  onToggle: (w: SampleCoursework) => void
}) {
  const filtered = filter !== "all"
  const shown = items.filter((w) => !filtered || w.type === filter)
  const groups = groupAgenda(shown, SAMPLE_TODAY, isDone)
  if (shown.length === 0) {
    return <Empty>{filtered ? `No ${TYPE_LABEL[filter].toLowerCase()}s in this course.` : "Nothing scheduled for this course."}</Empty>
  }
  return (
    <View style={styles.list}>
      {AGENDA_ORDER.map((group) => {
        const rows = groups[group]
        if (rows.length === 0 && !filtered) return null
        return (
          <View key={group} style={styles.group}>
            <SectionLabel>{GROUP_LABEL[group]}</SectionLabel>
            {rows.length === 0 ? <Empty>{`Nothing in ${GROUP_LABEL[group].toLowerCase()}.`}</Empty> : null}
            {rows.map((w) => {
              const done = isDone(w)
              const tint = TYPE_TONE[w.type]
              return (
                <ListRow
                  key={w.id}
                  title={w.title}
                  subtitle={`Due ${shortDate(w.due)}${w.score ? ` · Score ${w.score}` : ""}`}
                  done={done}
                  left={<Checkbox checked={done} onPress={() => onToggle(w)} label={`${done ? "Mark not done" : "Mark done"}: ${w.title}`} />}
                  right={
                    <View style={styles.type}>
                      <Icon name={TYPE_ICON[w.type]} size={16} tint={tint} />
                      <Badge label={TYPE_LABEL[w.type]} tint={tint} />
                    </View>
                  }
                />
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  group: { gap: 2 },
  type: { flexDirection: "row", alignItems: "center", gap: 6 },
})
