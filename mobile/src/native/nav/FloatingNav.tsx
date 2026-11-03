import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { color } from "../../theme.ts"
import { Icon, tone, type IconName } from "../ui.tsx"
import { findDestination, PRIMARY, type ScreenKey } from "./destinations.ts"
import { CHOOSE_COLLAPSE_MS, CLOSE_MS, navDuration, OPEN_MS } from "./motion.ts"
import { useReduceMotion } from "./useReduceMotion.ts"

const SIZE = 56
const EDGE = 16

type Props = {
  current: ScreenKey
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (key: ScreenKey) => void
  /** Opens the launcher sheet ("All"). */
  onAll: () => void
}

/**
 * A 56dp bubble at the bottom-right showing the current screen's icon. Tap it and it grows
 * into a mini bar (Home, Planner, Learning, Projects, All). One Animated.Value drives
 * everything with the native driver: the bar's background is scaled from a bubble-sized
 * pill (never an animated width) while the slots and the bubble cross-fade.
 * Hidden while the keyboard is up. Reduce motion makes every duration 0.
 */
export function FloatingNav({ current, open, onOpenChange, onSelect, onAll }: Props) {
  const reduce = useReduceMotion()
  const { width } = useWindowDimensions()
  const p = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [keyboard, setKeyboard] = useState(false)

  const barW = Math.max(SIZE, Math.min(width - 2 * EDGE, 320))
  const anim = useMemo(() => {
    const s0 = SIZE / barW
    const clamp = { extrapolate: "clamp" } as const
    return {
      scaleX: p.interpolate({ inputRange: [0, 1], outputRange: [s0, 1] }),
      shift: p.interpolate({ inputRange: [0, 1], outputRange: [(barW * (1 - s0)) / 2, 0] }),
      bg: p.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], ...clamp }),
      slots: p.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], ...clamp }),
      bubble: p.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], ...clamp }),
    }
  }, [p, barW])

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  useEffect(() => {
    if (keyboard && open) onOpenChange(false)
  }, [keyboard, open, onOpenChange])

  useEffect(() => {
    Animated.timing(p, { toValue: open ? 1 : 0, duration: navDuration(reduce, open ? OPEN_MS : CLOSE_MS), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [open, reduce, p])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function choose(key: ScreenKey) {
    onSelect(key)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onOpenChange(false), navDuration(reduce, CHOOSE_COLLAPSE_MS))
  }

  if (keyboard) return null
  const here = findDestination(current)
  const onBar = PRIMARY.some((d) => d.key === current)

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)} accessible={false} importantForAccessibility="no" /> : null}
      <View style={[styles.anchor, { width: barW }]} pointerEvents="box-none">
        <Animated.View pointerEvents="none" style={[styles.bar, { opacity: anim.bg, transform: [{ translateX: anim.shift }, { scaleX: anim.scaleX }] }]} />
        <Animated.View
          style={[styles.slots, { opacity: anim.slots }]}
          pointerEvents={open ? "auto" : "none"}
          accessibilityRole="tablist"
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        >
          {PRIMARY.map((d) => (
            <Slot key={d.key} label={d.label} icon={current === d.key ? d.activeIcon : d.icon} active={current === d.key} role="tab" onPress={() => d.key !== "settings" && choose(d.key)} />
          ))}
          <Slot
            label="All"
            icon={onBar ? "grid-outline" : "grid"}
            active={!onBar}
            role="button"
            onPress={() => {
              onAll()
              onOpenChange(false)
            }}
          />
        </Animated.View>
        <Animated.View style={[styles.bubbleWrap, { opacity: anim.bubble }]} pointerEvents={open ? "none" : "auto"}>
          <Pressable
            onPress={() => onOpenChange(true)}
            style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open navigation, on ${here.label}`}
            accessibilityState={{ expanded: open }}
          >
            <Icon name={here.activeIcon} size={26} tint={color.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  )
}

function Slot({ label, icon, active, role, onPress }: { label: string; icon: IconName; active: boolean; role: "tab" | "button"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === "tab" ? { selected: active } : undefined}
    >
      <Icon name={icon} size={22} tint={active ? tone.red : color.muted} />
      <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", right: EDGE, bottom: EDGE, height: SIZE },
  bar: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: SIZE / 2, backgroundColor: color.panel, borderWidth: 1, borderColor: color.border, elevation: 8 },
  slots: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  slot: { flex: 1, height: SIZE - 8, borderRadius: (SIZE - 8) / 2, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { color: color.muted, fontSize: 11, fontWeight: "600" },
  labelActive: { color: tone.red },
  pressed: { backgroundColor: color.raised },
  bubbleWrap: { position: "absolute", right: 0, bottom: 0, width: SIZE, height: SIZE },
  bubble: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: color.panel, borderWidth: 1, borderColor: color.border, elevation: 8 },
})
