import { useEffect, useState } from "react"
import { BackHandler, StyleSheet, View } from "react-native"
import { color } from "../theme.ts"
import { WorkspaceProvider } from "./data/WorkspaceProvider.tsx"
import { PillNav } from "./nav/PillNav.tsx"
import { KEEP_ALIVE, type ScreenKey } from "./nav/destinations.ts"
import { SCREENS } from "./nav/screens.tsx"
import { SnackHost } from "./snack/SnackHost.tsx"
import type { NativeHomeProps } from "./index.ts"

/** Shared screen host with a persistent floating pill and an anchored More menu. */
export function NativeShell({ address, onOpenSettings }: NativeHomeProps) {
  const [current, setCurrent] = useState<ScreenKey>("home")
  const [moreOpen, setMoreOpen] = useState(false)
  const Current = SCREENS[current]
  // Screens in KEEP_ALIVE stay mounted (hidden) after their first visit, so e.g. open Mikoshi tools keep their place.
  const [seen, setSeen] = useState<ScreenKey[]>([])
  useEffect(() => { if (KEEP_ALIVE.includes(current)) setSeen((s) => (s.includes(current) ? s : [...s, current])) }, [current])
  const kept = KEEP_ALIVE.filter((k) => seen.includes(k) || k === current)

  useEffect(() => {
    if (!moreOpen) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setMoreOpen(false)
      return true
    })
    return () => sub.remove()
  }, [moreOpen])

  return (
    <WorkspaceProvider key={address} address={address}>
      <View style={styles.root}>
        <View style={styles.page} accessibilityElementsHidden={moreOpen} importantForAccessibility={moreOpen ? "no-hide-descendants" : "auto"}>
          {KEEP_ALIVE.includes(current) ? null : <Current onOpenSettings={onOpenSettings} />}
          {kept.map((k) => { const Kept = SCREENS[k]; return <View key={k} style={k === current ? styles.page : styles.hidden}><Kept onOpenSettings={onOpenSettings} focused={k === current} /></View> })}
          <SnackHost />
        </View>
        <PillNav current={current} moreOpen={moreOpen} onMoreOpen={setMoreOpen} onSelect={setCurrent} onOpenSettings={onOpenSettings} />
      </View>
    </WorkspaceProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: color.ground },
  page: { flex: 1 },
  hidden: { display: "none" },
})

