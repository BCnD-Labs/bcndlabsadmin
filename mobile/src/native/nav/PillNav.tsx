import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { navLayout } from "./layout.ts"
import { DESTINATIONS, PRIMARY, type Destination, type ScreenKey } from "./destinations.ts"
import { useReduceMotion } from "./useReduceMotion.ts"

const ACCENT = c.accent
const HEIGHT = 42
const EDGE = 12
const INSET = 3

type Props = {
  current: ScreenKey
  moreOpen: boolean
  onMoreOpen: (open: boolean) => void
  onSelect: (key: ScreenKey) => void
  onOpenSettings: () => void
}

/** Persistent floating track. Only taps navigate; the selected pill slides as visual feedback. */
export function PillNav({ current, moreOpen, onMoreOpen, onSelect, onOpenSettings }: Props) {
  const reduce = useReduceMotion()
  const { width, height, fontScale } = useWindowDimensions()
  const [keyboard, setKeyboard] = useState(false)
  const [slots, setSlots] = useState<Record<string, { x: number; width: number }>>({})
  const x = useRef(new Animated.Value(INSET)).current
  const pillWidth = useRef(new Animated.Value(0)).current
  const ready = useRef(false)
  const primary = PRIMARY.some((d) => d.key === current)
  const selected = moreOpen || !primary ? "more" : current
  const { barWidth, barLeft } = navLayout(width)
  const barHeight = Math.max(HEIGHT, 24 + Math.min(fontScale, 2) * 14)
  const selectedSlot = slots[selected]

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => { setKeyboard(true); onMoreOpen(false) })
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false))
    return () => { show.remove(); hide.remove() }
  }, [onMoreOpen])

  useEffect(() => {
    if (!selectedSlot) return
    const duration = reduce || !ready.current ? 0 : 190
    const config = { duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }
    Animated.parallel([
      Animated.timing(x, { ...config, toValue: selectedSlot.x }),
      Animated.timing(pillWidth, { ...config, toValue: selectedSlot.width }),
    ]).start()
    ready.current = true
  }, [selectedSlot, reduce, x, pillWidth])

  function choose(d: Destination) {
    onMoreOpen(false)
    if (d.key === "settings") onOpenSettings()
    else onSelect(d.key)
  }

  if (keyboard) return null
  const items = [...PRIMARY, { key: "more", label: "More", icon: "ellipsis-horizontal" as const, activeIcon: "ellipsis-horizontal" as const }]
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {moreOpen ? <Pressable style={StyleSheet.absoluteFill} onPress={() => onMoreOpen(false)} accessibilityRole="button" accessibilityLabel="Close More menu" /> : null}
      <View style={[styles.anchor, { width: barWidth, left: barLeft }]} pointerEvents="box-none">
        {moreOpen ? (
          <View style={[styles.menu, { bottom: barHeight + 8, maxHeight: Math.max(80, height - barHeight - 48) }]} accessibilityViewIsModal>
            <Text style={styles.menuTitle} accessibilityRole="header">More</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {DESTINATIONS.filter((d) => !d.primary).map((d) => (
                <Pressable key={d.key} onPress={() => choose(d)} accessibilityRole="button" accessibilityState={{ selected: d.key === current }}
                  style={({ pressed }) => [styles.menuRow, d.key === current && styles.menuSelected, pressed && styles.pressed]}>
                  <Icon name={d.key === current ? d.activeIcon : d.icon} size={17} tint={d.key === current ? ACCENT : c.text2} />
                  <Text style={[styles.menuLabel, d.key === current && styles.activeText]}>{d.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        <View style={[styles.track, { minHeight: barHeight }]} accessibilityRole="tablist">
          <Animated.View pointerEvents="none" style={[styles.highlight, { left: x, width: pillWidth }]} />
          {items.map((d) => {
            const active = selected === d.key
            const more = d.key === "more"
            return (
              <Pressable key={d.key} onPress={() => more ? onMoreOpen(!moreOpen) : choose(d as Destination)}
                onLayout={({ nativeEvent: { layout } }) => setSlots((all) => all[d.key]?.x === layout.x && all[d.key]?.width === layout.width ? all : { ...all, [d.key]: { x: layout.x, width: layout.width } })}
                accessibilityRole={more ? "button" : "tab"} accessibilityLabel={d.label}
                accessibilityState={more ? { expanded: moreOpen } : { selected: current === d.key }}
                style={({ pressed }) => [styles.slot, { flex: active ? 1.9 : 1 }, pressed && styles.pressed]}>
                <Icon name={d.icon} size={18} tint={active ? ACCENT : c.text2} />
                {active ? <Text numberOfLines={1} style={styles.label}>{d.label}</Text> : null}
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", bottom: EDGE },
  track: { flexDirection: "row", alignItems: "stretch", padding: INSET, borderRadius: 40, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, elevation: 10, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  highlight: { position: "absolute", top: INSET, bottom: INSET, borderRadius: 32, backgroundColor: c.selected, borderWidth: 1, borderColor: c.selectedBorder },
  slot: { minWidth: 32, minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 24 },
  label: { flexShrink: 1, color: ACCENT, fontSize: 11, fontWeight: "600" },
  pressed: { backgroundColor: c.raised },
  menu: { position: "absolute", right: 0, width: 190, padding: 4, borderRadius: 14, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border, elevation: 14, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  menuTitle: { color: c.muted, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 5 },
  menuRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 },
  menuSelected: { backgroundColor: c.selected },
  menuLabel: { flexShrink: 1, color: c.text, fontSize: 12 },
  activeText: { color: ACCENT },
})
