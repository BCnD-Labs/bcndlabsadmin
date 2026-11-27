import { useEffect, useState } from "react"
import { BackHandler, StyleSheet, View } from "react-native"
import { CrashGuard } from "../components/CrashGuard.tsx"
import { color } from "../theme.ts"
import { WorkspaceProvider } from "./data/WorkspaceProvider.tsx"
import { PillNav } from "./nav/PillNav.tsx"
import { SideNav } from "./nav/SideNav.tsx"
import { useLayoutMode } from "./nav/useLayoutMode.ts"
import { QuickAdd, QuickAddProvider } from "./quickadd/QuickAdd.tsx"
import { KEEP_ALIVE, findDestination, type ScreenKey } from "./nav/destinations.ts"
import { targetFor, type NavigationTarget } from "./nav/target.ts"
import { SCREENS } from "./nav/screens.tsx"
import { SnackHost } from "./snack/SnackHost.tsx"
import type { NativeHomeProps } from "./index.ts"

/** Shared screen host with a persistent floating pill, an anchored More menu and the quick-add button. */
export function NativeShell({ address, onOpenSettings, onUseWeb }: NativeHomeProps) {
  const [current, setCurrent] = useState<ScreenKey>("home")
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget>()
  function navigate(screen: ScreenKey, target?: NavigationTarget) {
    setNavigationTarget(targetFor(screen, target))
    setCurrent(screen)
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const { landscape } = useLayoutMode()
  // The More menu belongs to the bottom bar; rotating to landscape closes it.
  useEffect(() => { if (landscape) setMoreOpen(false) }, [landscape])
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
      <QuickAddProvider>
      <View style={[styles.root, landscape && styles.rootLandscape]}>
        {landscape ? <SideNav key="side" current={current} onSelect={screen => navigate(screen)} /> : null}
        <View key="page" style={styles.page} accessibilityElementsHidden={moreOpen} importantForAccessibility={moreOpen ? "no-hide-descendants" : "auto"}>
          {KEEP_ALIVE.includes(current) ? null : <CrashGuard key={current} scope="screen" label={findDestination(current).label} onUseWeb={onUseWeb} onOpenSettings={onOpenSettings}><Current onOpenSettings={onOpenSettings} onNavigate={navigate} navigationTarget={targetFor(current, navigationTarget)} onUseWeb={onUseWeb} /></CrashGuard>}
          {kept.map((k) => { const Kept = SCREENS[k]; return <View key={k} style={k === current ? styles.page : styles.hidden}><CrashGuard scope="screen" label={findDestination(k).label} onUseWeb={onUseWeb} onOpenSettings={onOpenSettings}><Kept onOpenSettings={onOpenSettings} onNavigate={navigate} navigationTarget={k === current ? targetFor(k, navigationTarget) : undefined} onUseWeb={onUseWeb} focused={k === current} /></CrashGuard></View> })}
          <SnackHost />
        </View>
        {landscape ? null : <PillNav current={current} moreOpen={moreOpen} onMoreOpen={setMoreOpen} onSelect={screen => navigate(screen)} />}
        <QuickAdd sidebar={landscape} />
      </View>
      </QuickAddProvider>
    </WorkspaceProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: color.ground },
  rootLandscape: { flexDirection: "row" },
  page: { flex: 1, minWidth: 0 },
  hidden: { display: "none" },
})

