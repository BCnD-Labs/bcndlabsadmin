import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { Card, Icon, type IconName, Screen, SampleBadge } from "../ui.tsx"
import { BackButton } from "./more/BackButton.tsx"
import { InsightsView } from "./more/InsightsView.tsx"
import { NotesView } from "./more/NotesView.tsx"
import { WebsiteView } from "./more/WebsiteView.tsx"

type SubView = "notes" | "insights" | "website"

const TITLES: Record<SubView, string> = { notes: "Notes", insights: "Insights", website: "Website" }

/** The More menu. Notes, Insights and Website open in-screen sub-views; Settings goes straight to the settings. */
export function MoreScreen(props: { onOpenSettings: () => void }) {
  const [open, setOpen] = useState<SubView | null>(null)

  if (open) {
    return (
      <Screen title={TITLES[open]} right={<SampleBadge />}>
        <BackButton onPress={() => setOpen(null)} label="Back to More" />
        {open === "notes" ? <NotesView /> : null}
        {open === "insights" ? <InsightsView /> : null}
        {open === "website" ? <WebsiteView /> : null}
      </Screen>
    )
  }

  return (
    <Screen title="More" right={<SampleBadge />}>
      <Card>
        <MenuRow icon="document-text-outline" label="Notes" subtitle="Quick notes, sample set" onPress={() => setOpen("notes")} />
        <MenuRow icon="stats-chart-outline" label="Insights" subtitle="This week at a glance" onPress={() => setOpen("insights")} />
        <MenuRow icon="globe-outline" label="Website" subtitle="Site traffic, sample data" onPress={() => setOpen("website")} />
        <MenuRow icon="settings-outline" label="Settings" subtitle="Address, web view and native view" onPress={props.onOpenSettings} />
      </Card>
      <Text style={styles.note}>Web view is always available: open Settings and choose Web view.</Text>
    </Screen>
  )
}

function MenuRow({ icon, label, subtitle, onPress }: { icon: IconName; label: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} tint={color.text2} />
      <View style={styles.text}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={18} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6 },
  pressed: { opacity: 0.7 },
  text: { flex: 1 },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  sub: { color: color.muted, fontSize: 12, marginTop: 2 },
  note: { color: color.faint, fontSize: 12, paddingHorizontal: 4 },
})
