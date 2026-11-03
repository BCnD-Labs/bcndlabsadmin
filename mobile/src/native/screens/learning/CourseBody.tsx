import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Card, Chip, ChipRow, Icon, ListRow, TYPE_LABEL, TYPE_TONE, type IconName } from "../../ui.tsx"
import type { CourseworkType, SampleCourse, SampleCoursework } from "../../sample.ts"
import { AgendaList } from "./AgendaList.tsx"
import { PanelLists } from "./PanelLists.tsx"
import { PanelsButton, type Anchor } from "./PanelsButton.tsx"
import { PanelsPopover } from "./PanelsPopover.tsx"
import { initialPanels, panelsOn, togglePanel } from "./panels.ts"

const TYPES: CourseworkType[] = ["assignment", "exam", "milestone", "event"]

const SOURCES: { label: string; icon: IconName }[] = [
  { label: "Lecture notes", icon: "document-text-outline" },
  { label: "Reference and sources", icon: "library-outline" },
  { label: "Assignment notes", icon: "create-outline" },
  { label: "Study log", icon: "list-outline" },
]

/** The body of one course view: back button and panels choice, type filter, agenda, chosen panels and sources. */
export function CourseBody({
  course,
  items,
  isDone,
  onToggle,
  onBack,
}: {
  course: SampleCourse
  items: SampleCoursework[]
  isDone: (w: SampleCoursework) => boolean
  onToggle: (w: SampleCoursework) => void
  onBack: () => void
}) {
  const [filter, setFilter] = useState<CourseworkType | "all">("all")
  const [panels, setPanels] = useState(initialPanels)
  const [popover, setPopover] = useState<{ anchor: Anchor | null } | null>(null)
  const countOf = (type: CourseworkType) => items.filter((w) => w.type === type).length
  return (
    <>
      <View style={styles.headRow}>
        <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to all courses">
          <Icon name="chevron-back" size={20} tint={color.text2} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <PanelsButton count={panelsOn(panels)} onOpen={(anchor) => setPopover({ anchor })} />
      </View>
      <Text style={styles.meta}>{`${course.instructor} · ${course.schedule} · ${course.credits} credits`}</Text>

      <ChipRow>
        <Chip label={`All ${items.length}`} active={filter === "all"} onPress={() => setFilter("all")} />
        {TYPES.map((t) => (
          <Chip
            key={t}
            label={`${TYPE_LABEL[t]} ${countOf(t)}`}
            dot={TYPE_TONE[t]}
            active={filter === t}
            onPress={() => setFilter(t)}
          />
        ))}
      </ChipRow>

      <AgendaList items={items} filter={filter} isDone={isDone} onToggle={onToggle} />

      <PanelLists items={items} on={panels} isDone={isDone} />
      <PanelsPopover
        visible={popover !== null}
        anchor={popover?.anchor ?? null}
        items={items}
        on={panels}
        onToggle={(type) => setPanels((s) => togglePanel(s, type))}
        onClose={() => setPopover(null)}
      />

      <Card title="Notes and sources">
        {SOURCES.map((s) => (
          <ListRow key={s.label} title={s.label} subtitle="Not linked yet" left={<Icon name={s.icon} size={20} />} />
        ))}
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 4 },
  backText: { color: color.text2, fontSize: 15, fontWeight: "600" },
  meta: { color: color.muted, fontSize: 13 },
})
