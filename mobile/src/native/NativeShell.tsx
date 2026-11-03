import { useEffect, useState } from "react"
import { BackHandler, StyleSheet, View } from "react-native"
import { color } from "../theme.ts"
import { FloatingNav } from "./nav/FloatingNav.tsx"
import { LauncherSheet } from "./nav/LauncherSheet.tsx"
import type { ScreenKey } from "./nav/destinations.ts"
import { SCREENS } from "./nav/screens.tsx"
import type { NativeHomeProps } from "./index.ts"

/**
 * Native Blackwall skeleton: one screen fills the area and a floating bubble (bottom-right)
 * opens a mini bar and an "All" launcher. Nothing here talks to the server yet; screens show
 * sample data with a "Sample data" badge. The web view is always one tap away: Settings (edge
 * handle or the launcher) switches back.
 */
export function NativeShell({ onOpenSettings }: NativeHomeProps) {
  const [current, setCurrent] = useState<ScreenKey>("home")
  const [navOpen, setNavOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const Current = SCREENS[current]

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
      <FloatingNav current={current} open={navOpen} onOpenChange={setNavOpen} onSelect={setCurrent} onAll={() => setSheetOpen(true)} />
      <LauncherSheet visible={sheetOpen} current={current} onSelect={setCurrent} onOpenSettings={onOpenSettings} onClose={() => setSheetOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: color.ground },
})
