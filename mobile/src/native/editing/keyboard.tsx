import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from "react"
import { Keyboard, ScrollView, TextInput as NativeInput, View, type ScrollViewProps, type ViewProps } from "react-native"
import { focusScroll, keyboardInset } from "./keyboard-geometry.ts"

export function useKeyboardTop() {
  const [top, setTop] = useState<number | null>(() => Keyboard.metrics()?.screenY ?? null)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", e => setTop(e.endCoordinates.screenY))
    const frame = Keyboard.addListener("keyboardDidChangeFrame", e => setTop(e.endCoordinates.screenY))
    const hide = Keyboard.addListener("keyboardDidHide", () => setTop(null))
    return () => { show.remove(); frame.remove(); hide.remove() }
  }, [])
  return top
}

/** Works for both resized Android windows and edge-to-edge overlays, without subtracting twice. */
export function KeyboardFrame({ children, style, onLayout, ...props }: ViewProps & { children: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null), top = useKeyboardTop()
  const [inset, setInset] = useState(0)
  const measure = useCallback(() => ref.current?.measureInWindow((_x, y, _w, h) => setInset(keyboardInset(y, h, top))), [top])
  useEffect(() => { const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id) }, [measure])
  return <View {...props} ref={ref} style={[style, { paddingBottom: inset }]} onLayout={e => { onLayout?.(e); measure() }}>{children}</View>
}

type Reveal = (field: ComponentRef<typeof NativeInput> | null) => void
const Focus = createContext<Reveal>(() => {})
/** Registered fields reveal themselves after focus, keyboard resizing, and multiline growth. */
export function KeyboardScrollView({ children, onScroll, onLayout, onContentSizeChange, contentContainerStyle, ...props }: ScrollViewProps) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null), field = useRef<ComponentRef<typeof NativeInput> | null>(null), offset = useRef(0), top = useKeyboardTop()
  const reveal = useCallback((input: ComponentRef<typeof NativeInput> | null = field.current) => {
    field.current = input
    requestAnimationFrame(() => {
      if (!input?.isFocused()) return
      ref.current?.measureInWindow((_x, y, _w, h) => input.measureInWindow((_fx, fy, _fw, fh) => {
        const next = focusScroll(offset.current, fy, fh, y, h)
        if (Math.abs(next - offset.current) > 1) ref.current?.scrollTo({ y: next, animated: true })
      }))
    })
  }, [])
  useEffect(() => { if (top != null) reveal(field.current) }, [top, reveal])
  return <Focus.Provider value={reveal}><ScrollView {...props} ref={ref} keyboardShouldPersistTaps="handled" contentContainerStyle={[contentContainerStyle, top != null && { paddingBottom: 32 }]} scrollEventThrottle={16} onScroll={e => { offset.current = e.nativeEvent.contentOffset.y; onScroll?.(e) }} onLayout={e => { onLayout?.(e); reveal(field.current) }} onContentSizeChange={(w, h) => { onContentSizeChange?.(w, h); reveal(field.current) }}>{children}</ScrollView></Focus.Provider>
}

export const TextInput = forwardRef<ComponentRef<typeof NativeInput>, ComponentProps<typeof NativeInput>>(function TextInput({ onFocus, onContentSizeChange, onSelectionChange, ...props }, forwarded) {
  const ref = useRef<ComponentRef<typeof NativeInput> | null>(null), reveal = useContext(Focus)
  return <NativeInput {...props} ref={node => { ref.current = node; if (typeof forwarded === "function") forwarded(node); else if (forwarded) forwarded.current = node }} onFocus={e => { onFocus?.(e); reveal(ref.current) }} onContentSizeChange={e => { onContentSizeChange?.(e); reveal(ref.current) }} onSelectionChange={e => { onSelectionChange?.(e); reveal(ref.current) }} />
})
