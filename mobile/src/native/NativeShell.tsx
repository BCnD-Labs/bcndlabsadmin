import { useEffect, useState } from "react"
import { BackHandler, StyleSheet, View } from "react-native"
import { loadNavSide, saveNavSide } from "../lib/storage.ts"
import { color } from "../theme.ts"
import { FloatingNav } from "./nav/FloatingNav.tsx"
import { LauncherSheet } from "./nav/LauncherSheet.tsx"
import type { ScreenKey } from "./nav/destinations.ts"
import type { NavSide } from "./nav/side.ts"
import { SCREENS } from "./nav/screens.tsx"
import type { NativeHomeProps } from "./index.ts"

/**
 * Native Blackwall skeleton: one screen fills the area and a floating bubble (bottom left,
 * center or right, your choice) opens a mini bar and an "All" launcher. Nothing here talks to
 * the server yet; screens show sample data with a "Sample data" badge. The web view is always
 * one tap away: Settings (edge handle or the launcher) switches back.
 */
export function NativeShell({ onOpenSettings }: NativeHomeProps) {
  const [current, setCurrent] = useState<ScreenKey>("home")
  const [navOpen, setNavOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // null until the saved side has loaded, so the bubble never jumps from the default.
  const [side, setSide] = useState<NavSide | null>(null)
  const Current = SCREENS[current]

  useEffect(() => {
    let alive = true
    loadNavSide().then((s) => {
      if (alive) setSide(s)
    })
    return () => {
      alive = false
    }
  }, [])

  function changeSide(next: NavSide) {
    setSide(next)
    void saveNavSide(next)
  }

  // Android Back closes the sheet, then the bar. With neither open no handler is registered,
  // so Back keeps its default behaviour.
  useEffect(() => {
    if (!navOpen && !sheetOpen) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sheetOpen) setSheetOpen(false)
      else setNavOpen(false)
      return true
    })
    return () => sub.remove()
  }, [navOpen, sheetOpen])

  return (
    <View style={styles.root}>
      <Current onOpenSettings={onOpenSettings} />
      {side ? (
        <>
          <FloatingNav side={side} current={current} open={navOpen} onOpenChange={setNavOpen} onSelect={setCurrent} onAll={() => setSheetOpen(true)} />
          <LauncherSheet visible={sheetOpen} side={side} onSideChange={changeSide} current={current} onSelect={setCurrent} onOpenSettings={onOpenSettings} onClose={() => setSheetOpen(false)} />
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: color.ground },
})
