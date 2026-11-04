import { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Easing, useWindowDimensions, type LayoutChangeEvent } from "react-native"
import { growTarget } from "./sheet-size.ts"

/** Small editor to large editor: a quick grow with a barely-there bounce at the end; back is a plain ease-out. */
export const EXPAND_MS = 240
export const COLLAPSE_MS = 190
const BOUNCE = 1.1

/**
 * Drives an editor card between its small (natural) height and a large one, by animating one height
 * instead of swapping cards. Put `onLayout` and `style` on an `Animated.View`; `expanded` says which
 * content to show. With "reduce motion" on it jumps. `expanded` flips at the start of a grow and at the
 * end of a shrink, so the larger content is there for the whole animation.
 */
export function useGrow(reduceMotion: boolean) {
  const { height: screen } = useWindowDimensions()
  const height = useRef(new Animated.Value(0)).current
  const small = useRef(0)
  const sized = useRef(false)
  const open = useRef(false)
  const run = useRef<Animated.CompositeAnimation | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [fixed, setFixed] = useState(false)
  useEffect(() => () => run.current?.stop(), [])

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    if (!sized.current) small.current = e.nativeEvent.layout.height
  }, [])

  const expand = useCallback(() => {
    if (open.current) return
    open.current = true
    setExpanded(true)
    const from = small.current
    if (!(from > 0)) return // never measured: the card just takes its larger maximum height
    const to = growTarget(from, screen)
    run.current?.stop()
    if (!sized.current) height.setValue(from)
    sized.current = true
    setFixed(true)
    if (reduceMotion) return height.setValue(to)
    run.current = Animated.timing(height, { toValue: to, duration: EXPAND_MS, easing: Easing.out(Easing.back(BOUNCE)), useNativeDriver: false })
    run.current.start()
  }, [height, reduceMotion, screen])

  const collapse = useCallback(() => {
    if (!open.current) return
    open.current = false
    const done = () => { sized.current = false; setFixed(false); setExpanded(false) }
    if (reduceMotion || !sized.current) return done()
    run.current?.stop()
    run.current = Animated.timing(height, { toValue: small.current, duration: COLLAPSE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false })
    run.current.start(({ finished }) => finished && done())
  }, [height, reduceMotion])

  const toggle = useCallback(() => (open.current ? collapse() : expand()), [collapse, expand])
  const style = fixed ? { height } : expanded ? { maxHeight: "88%" as const } : undefined
  return { expanded, expand, collapse, toggle, onLayout, style }
}
