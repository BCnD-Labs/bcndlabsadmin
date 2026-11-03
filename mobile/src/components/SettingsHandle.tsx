import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, PanResponder, StyleSheet, View, type LayoutRectangle } from "react-native"
import { loadHandle, saveHandle, type HandlePosition } from "../lib/storage.ts"

const W = 14 // visible width of the tab
const H = 52
const HIT = 44 // touch target width, extending inward from the edge
const TAP_SLOP = 6

/**
 * A small translucent tab on the screen edge that opens native Settings. Tap it to open;
 * drag it anywhere up or down either edge (it snaps to the nearest side and remembers
 * where you left it), so it never has to sit on top of something you need.
 *
 * Why a handle and not a gesture: Android's own back gesture owns both screen edges,
 * long-press belongs to text selection, pulling down from the top opens the
 * notification shade, and pulling down on the page is pull-to-refresh. A visible,
 * movable tab is the one control that doesn't collide with any of them.
 */
export function SettingsHandle({ area, onOpen, badge, reserveBottom = 0 }: { area: LayoutRectangle | null; onOpen: () => void; badge?: boolean; reserveBottom?: number }) {
  const [pos, setPos] = useState<HandlePosition | null>(null)
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const moved = useRef(false)

  useEffect(() => {
    void loadHandle().then(setPos)
  }, [])

  // reserveBottom keeps the handle clear of anything floating at the bottom (the native nav bubble).
  const travel = area ? Math.max(0, area.height - H - reserveBottom) : 0
  const top = pos ? pos.y * travel : 0

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          moved.current = false
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP) moved.current = true
          drag.setValue({ x: g.dx, y: g.dy })
        },
        onPanResponderRelease: (_e, g) => {
          drag.setValue({ x: 0, y: 0 })
          if (!moved.current) return onOpen()
          if (!area || !pos) return
          const startX = pos.side === "right" ? area.width - HIT : 0
          const side: HandlePosition["side"] = startX + HIT / 2 + g.dx > area.width / 2 ? "right" : "left"
          const y = travel > 0 ? Math.min(1, Math.max(0, (top + g.dy) / travel)) : 0
          const next = { side, y }
          setPos(next)
          void saveHandle(next)
        },
        onPanResponderTerminate: () => drag.setValue({ x: 0, y: 0 }),
      }),
    [area, pos, travel, top, drag, onOpen],
  )

  if (!area || !pos) return null
  const right = pos.side === "right"

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.hit, { top, [right ? "right" : "left"]: 0, alignItems: right ? "flex-end" : "flex-start" }, { transform: drag.getTranslateTransform() }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={badge ? "App settings, update available" : "App settings"}
      accessibilityHint="Opens Blackwall app settings. Drag to move this handle."
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={onOpen}
    >
      <View style={[styles.tab, right ? styles.tabRight : styles.tabLeft]}>
        <View style={styles.grip} />
        <View style={styles.grip} />
        {badge ? <View style={styles.badge} /> : null}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hit: { position: "absolute", width: HIT, height: H, justifyContent: "center", zIndex: 10 },
  tab: {
    width: W,
    height: H,
    backgroundColor: "rgba(54, 60, 70, 0.62)",
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabRight: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0 },
  tabLeft: { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderLeftWidth: 0 },
  badge: { position: "absolute", top: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: "#c92a2a", borderWidth: 1, borderColor: "#1f2228" },
  grip: { width: 2, height: 12, borderRadius: 1, backgroundColor: "rgba(231, 234, 238, 0.55)" },
})
