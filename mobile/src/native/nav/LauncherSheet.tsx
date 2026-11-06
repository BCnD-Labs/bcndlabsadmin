import { shape } from "../../shape.ts"
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { color } from "../../theme.ts"
import { Icon, SectionLabel, tone } from "../ui.tsx"
import { launcherGroups, type Destination, type ScreenKey } from "./destinations.ts"
import { navDuration, SHEET_MS } from "./motion.ts"
import { NAV_SIDES, type NavSide } from "./side.ts"
import { useReduceMotion } from "./useReduceMotion.ts"

const PAD = 16
const GAP = 8
const COLUMNS = 3

const SIDE_LABEL: Record<NavSide, string> = { left: "Left", center: "Center", right: "Right" }

type Props = {
  visible: boolean
  side: NavSide
  onSideChange: (side: NavSide) => void
  current: ScreenKey
  onSelect: (key: ScreenKey) => void
  onOpenSettings: () => void
  onClose: () => void
}

/** The "All" bottom sheet: every destination that is not on the mini bar, grouped, in a 3-column grid. */
export function LauncherSheet({ visible, side, onSideChange, current, onSelect, onOpenSettings, onClose }: Props) {
  const reduce = useReduceMotion()
  const { width, height } = useWindowDimensions()
  const p = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(visible)
  if (visible && !mounted) setMounted(true)

  useEffect(() => {
    if (!mounted) return
    Animated.timing(p, { toValue: visible ? 1 : 0, duration: navDuration(reduce, SHEET_MS), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished && !visible) setMounted(false)
    })
  }, [visible, mounted, reduce, p])

  if (!mounted) return null
  const tile = Math.floor((width - 2 * PAD - GAP * (COLUMNS - 1)) / COLUMNS) - 1

  function choose(d: Destination) {
    if (d.key === "settings") onOpenSettings()
    else onSelect(d.key)
    onClose()
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[styles.backdrop, { opacity: p }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { maxHeight: height * 0.75, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}
        accessibilityViewIsModal
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            All
          </Text>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={22} tint={color.text2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {launcherGroups().map((g) => (
            <View key={g.group} style={styles.group}>
              <SectionLabel>{g.group}</SectionLabel>
              <View style={styles.grid}>
                {g.items.map((d) => {
                  const active = d.key === current
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => choose(d)}
                      style={({ pressed }) => [styles.tile, { width: tile }, active && styles.tileActive, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={d.label}
                      accessibilityState={{ selected: active }}
                    >
                      <Icon name={active ? d.activeIcon : d.icon} size={24} tint={active ? tone.red : color.text2} />
                      <Text numberOfLines={1} style={[styles.tileLabel, active && styles.tileLabelActive]}>
                        {d.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
          <View style={styles.group}>
            <SectionLabel>Bubble position</SectionLabel>
            <View style={styles.sides}>
              {NAV_SIDES.map((s) => {
                const active = s === side
                return (
                  <Pressable
                    key={s}
                    onPress={() => onSideChange(s)}
                    style={({ pressed }) => [styles.sideChip, active && styles.tileActive, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Move navigation to the ${s}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>{SIDE_LABEL[s]}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <Text style={styles.note}>Web view: Settings {">"} Web view</Text>
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: color.panel, borderTopLeftRadius: shape.dialog, borderTopRightRadius: shape.dialog, borderWidth: 1, borderBottomWidth: 0, borderColor: color.border, elevation: 16 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: color.border },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: PAD, paddingRight: 4 },
  title: { color: color.text, fontSize: 18, fontWeight: "700" },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: PAD, paddingBottom: PAD + 8, gap: 12 },
  group: { gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: { minHeight: 72, borderRadius: shape.card, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6, backgroundColor: color.raised, borderWidth: 1, borderColor: color.edge },
  sides: { flexDirection: "row", gap: GAP },
  sideChip: { flex: 1, minHeight: 48, borderRadius: shape.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, backgroundColor: color.raised, borderWidth: 1, borderColor: color.edge },
  tileActive: { backgroundColor: color.selected, borderColor: color.border },
  pressed: { backgroundColor: color.selected },
  tileLabel: { color: color.text2, fontSize: 13, fontWeight: "600" },
  tileLabelActive: { color: tone.red },
  note: { color: color.faint, fontSize: 12, paddingTop: 4 },
})

