import { useMemo, useRef } from "react"
import { Animated, Easing, PanResponder } from "react-native"
import { claimsSwipe, swipeStep } from "./period-swipe.ts"

/** How far the content follows the finger and slides in from, in dp. */
const DRIFT = 28

/**
 * Swiping the calendar changes its period: up or down in the month view, left or right in the others.
 * The content follows the finger a little, then the next or previous period slides in. Put `panHandlers`
 * and `style` on an Animated.View around the grid. With "reduce motion" on nothing moves, it just changes.
 */
export function usePeriodSwipe(vertical: boolean, onStep: (direction: -1 | 1) => void, reduceMotion: boolean) {
  const drift = useRef(new Animated.Value(0)).current
  const live = useRef({ vertical, onStep, reduceMotion })
  live.current = { vertical, onStep, reduceMotion }
  const settle = (to: number, ms: number) => Animated.timing(drift, { toValue: to, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => claimsSwipe(g.dx, g.dy, live.current.vertical),
    onPanResponderMove: (_, g) => {
      if (live.current.reduceMotion) return
      const delta = live.current.vertical ? g.dy : g.dx
      drift.setValue(Math.max(-DRIFT, Math.min(DRIFT, delta * 0.3)))
    },
    onPanResponderRelease: (_, g) => {
      const { vertical: v, onStep: step, reduceMotion: reduce } = live.current
      const direction = swipeStep(v ? g.dy : g.dx, v ? g.vy : g.vx)
      if (!direction) return reduce ? drift.setValue(0) : settle(0, 120)
      step(direction)
      if (reduce) return drift.setValue(0)
      drift.setValue(direction > 0 ? DRIFT : -DRIFT)
      settle(0, 170)
    },
    onPanResponderTerminate: () => settle(0, 120),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [drift])
  const style = {
    opacity: drift.interpolate({ inputRange: [-DRIFT, 0, DRIFT], outputRange: [0.55, 1, 0.55] }),
    transform: [vertical ? { translateY: drift } : { translateX: drift }],
  }
  return { panHandlers: pan.panHandlers, style }
}
