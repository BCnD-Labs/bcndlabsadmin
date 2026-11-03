import { Ionicons } from "@expo/vector-icons"
import type { ComponentProps, ReactNode } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { color } from "../theme.ts"
import { NAV_CLEARANCE } from "./nav/destinations.ts"

export { NAV_CLEARANCE }

/** Shared building blocks for the native skeleton screens. Plain React Native, no extra packages. */

export const tone = { blue: "#74a7ff", amber: "#f2b84b", green: "#6fcf97", red: "#ff8787", grey: "#aab1bc" } as const

export type IconName = ComponentProps<typeof Ionicons>["name"]

/** An icon from the Ionicons set (names are type-checked). */
export function Icon({ name, size = 20, tint = color.muted }: { name: IconName; size?: number; tint?: string }) {
  return <Ionicons name={name} size={size} color={tint} />
}

/** A scrolling page with a title. Keeps NAV_CLEARANCE at the bottom so the floating nav bubble never covers the last row. */
export function Screen({ title, subtitle, right, children, onRefresh, refreshing }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.text2} colors={[color.red]} progressBackgroundColor={color.panel} /> : undefined}
    >
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </ScrollView>
  )
}


export function Card({ title, right, children, onPress }: { title?: string; right?: ReactNode; children?: ReactNode; onPress?: () => void }) {
  const body = (
    <>
      {title ? (
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </>
  )
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
        {body}
      </Pressable>
    )
  return <View style={styles.card}>{body}</View>
}

/** Quick-filter chip (a row of these sits under the title). 32px+ touch target. */
export function Chip({ label, active, onPress, dot }: { label: string; active?: boolean; onPress?: () => void; dot?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroll}>
      {children}
    </ScrollView>
  )
}

/** A small tinted pill (type, status, count). */
export function Badge({ label, tint = tone.grey }: { label: string; tint?: string }) {
  return (
    <View style={[styles.badge, { borderColor: tint }]}>
      <Text style={[styles.badgeText, { color: tint }]}>{label}</Text>
    </View>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value))
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  )
}

export function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.box, checked && styles.boxOn]} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }}>
      {checked ? <Text style={styles.tick}>{"✓"}</Text> : null}
    </Pressable>
  )
}

/** One list row: optional left control, title + subtitle, optional right content. */
export function ListRow({ title, subtitle, left, right, onPress, done }: { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void; done?: boolean }) {
  const inner = (
    <>
      {left}
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, done && styles.rowDone]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  )
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
        {inner}
      </Pressable>
    )
  return <View style={styles.row}>{inner}</View>
}

/** A full-width 48px button. `primary` is the red call to action; otherwise it is an outlined one. */
export function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, primary ? styles.buttonPrimary : styles.buttonQuiet, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.buttonText, primary && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

export function Empty({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { padding: 16, paddingBottom: NAV_CLEARANCE, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: color.text, fontSize: 24, fontWeight: "700" },
  subtitle: { color: color.muted, fontSize: 13, marginTop: 2 },
  sample: { borderWidth: 1, borderColor: color.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: color.well },
  sampleText: { color: color.faint, fontSize: 11, fontWeight: "600" },
  card: { backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge, padding: 14, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: color.text, fontSize: 15, fontWeight: "700" },
  pressed: { backgroundColor: color.raised },
  chipScroll: { flexGrow: 0 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: color.panel, borderWidth: 1, borderColor: color.border },
  chipActive: { backgroundColor: color.red, borderColor: color.red },
  chipText: { color: color.text2, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  track: { height: 6, borderRadius: 3, backgroundColor: color.well, overflow: "hidden" },
  fill: { height: 6, backgroundColor: color.red },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: color.red, borderColor: color.red },
  tick: { color: "#fff", fontSize: 14, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 6 },
  rowTitle: { color: color.text, fontSize: 15, fontWeight: "600" },
  rowDone: { color: color.faint, textDecorationLine: "line-through" },
  rowSub: { color: color.muted, fontSize: 12, marginTop: 2 },
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonPrimary: { backgroundColor: color.red, borderColor: color.red },
  buttonQuiet: { backgroundColor: color.panel, borderColor: color.border },
  buttonText: { color: color.text, fontSize: 15, fontWeight: "700" },
  sectionLabel: { color: color.faint, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  empty: { color: color.muted, fontSize: 13, paddingVertical: 8 },
})
