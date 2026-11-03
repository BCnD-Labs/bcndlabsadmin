import { useRef, useState, type ReactNode } from "react"
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { plannerColor } from "../../planner-theme.ts"
import { Icon, tone } from "../../ui.tsx"
import { REVEAL, claimsDrag, positionFor, settle } from "./swipe.ts"

interface Props {
  children: ReactNode
  done: boolean
  starred: boolean
  onComplete: () => void
  onStar: () => void
  onDelete: () => void
}

/**
 * Wraps a task row with swipe actions: right completes (or reopens) it, left reveals Star and
 * Delete buttons. Swiping is a shortcut only: every action is also on the row's checkbox and star,
 * the long-press menu and TalkBack's actions menu (set on the row's text). Numbers and decisions
 * live in swipe.ts.
 */
export function SwipeRow({ children, done, starred, onComplete, onStar, onDelete }: Props) {
  const x = useRef(new Animated.Value(0)).current
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const latest = useRef({ onComplete, onStar, onDelete })
  latest.current = { onComplete, onStar, onDelete }

  function snap(to: number, then?: () => void) {
    Animated.timing(x, { toValue: to, duration: 160, useNativeDriver: true }).start(then)
  }
  function setOpenBoth(value: boolean) {
    openRef.current = value
    setOpen(value)
    snap(value ? -REVEAL : 0)
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => claimsDrag(g.dx, g.dy),
      onPanResponderMove: (_e, g) => x.setValue(positionFor(g.dx, openRef.current)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        const result = settle(positionFor(g.dx, openRef.current), g.vx)
        if (result === "complete") {
          openRef.current = false
          setOpen(false)
          snap(0)
          latest.current.onComplete()
        } else setOpenBoth(result === "open")
      },
      onPanResponderTerminate: () => snap(openRef.current ? -REVEAL : 0),
    }),
  ).current

  const act = (fn: () => void) => () => {
    setOpenBoth(false)
    fn()
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.doneHint} pointerEvents="none">
        <Icon name={done ? "arrow-undo" : "checkmark-circle"} size={24} tint={tone.green} />
      </View>
      <View style={styles.strip}>
        <Pressable onPress={act(onStar)} style={styles.button} accessibilityRole="button" accessibilityLabel={starred ? "Remove star" : "Star"} importantForAccessibility={open ? "yes" : "no-hide-descendants"}>
          <Icon name={starred ? "star" : "star-outline"} size={22} tint={tone.amber} />
          <Text style={styles.buttonText}>{starred ? "Unstar" : "Star"}</Text>
        </Pressable>
        <Pressable onPress={act(onDelete)} style={[styles.button, styles.danger]} accessibilityRole="button" accessibilityLabel="Delete" importantForAccessibility={open ? "yes" : "no-hide-descendants"}>
          <Icon name="trash-outline" size={22} tint={color.text} />
          <Text style={[styles.buttonText, styles.dangerText]}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.front, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
        {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenBoth(false)} accessibilityRole="button" accessibilityLabel="Close actions" /> : null}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 8 },
  front: { backgroundColor: plannerColor.ground },
  doneHint: { ...StyleSheet.absoluteFill, justifyContent: "center", paddingLeft: 16, backgroundColor: color.well },
  strip: { position: "absolute", top: 0, bottom: 0, right: 0, width: REVEAL, flexDirection: "row" },
  button: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: color.raised },
  danger: { backgroundColor: color.red },
  buttonText: { color: color.text2, fontSize: 11, fontWeight: "700" },
  dangerText: { color: color.text },
})
