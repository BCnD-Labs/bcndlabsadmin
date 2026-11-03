import { useState, type ComponentType } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../theme.ts"
import { Icon, type IconName } from "./ui.tsx"
import { DevScreen } from "./screens/DevScreen.tsx"
import { HomeScreen } from "./screens/HomeScreen.tsx"
import { LearningScreen } from "./screens/LearningScreen.tsx"
import { MoreScreen } from "./screens/MoreScreen.tsx"
import { PlannerScreen } from "./screens/PlannerScreen.tsx"
import type { NativeHomeProps } from "./index.ts"

type Tab = { key: string; label: string; icon: IconName; activeIcon: IconName; Screen: ComponentType<{ onOpenSettings: () => void }> }

/** The dock tabs. Each Screen lives in ./screens/ and owns its own content. */
const TABS: Tab[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home", Screen: HomeScreen },
  { key: "planner", label: "Planner", icon: "calendar-outline", activeIcon: "calendar", Screen: PlannerScreen },
  { key: "learning", label: "Learning", icon: "school-outline", activeIcon: "school", Screen: LearningScreen },
  { key: "dev", label: "Projects", icon: "git-branch-outline", activeIcon: "git-branch", Screen: DevScreen },
  { key: "more", label: "More", icon: "ellipsis-horizontal-circle-outline", activeIcon: "ellipsis-horizontal-circle", Screen: MoreScreen },
]

/**
 * Native Blackwall skeleton: a floating bottom dock over five screens. Nothing here talks to
 * the server yet; screens show sample data with a "Sample data" badge. The web view is always
 * one tap away: Settings (edge handle or the More tab) switches back.
 */
export function NativeShell({ onOpenSettings }: NativeHomeProps) {
  const [tab, setTab] = useState(TABS[0].key)
  const current = TABS.find((t) => t.key === tab) ?? TABS[0]
  const Screen = current.Screen
  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        <Screen onOpenSettings={onOpenSettings} />
      </View>
      <View style={styles.dock} accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t.label}>
              <Icon name={active ? t.activeIcon : t.icon} size={22} tint={active ? color.red : color.muted} />
              <Text style={[styles.label, active && styles.active]}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.ground },
  dock: { flexDirection: "row", marginHorizontal: 12, marginBottom: 8, marginTop: 4, padding: 6, borderRadius: 22, backgroundColor: color.panel, borderWidth: 1, borderColor: color.edge },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { color: color.muted, fontSize: 11, fontWeight: "600" },
  active: { color: color.red },
})
