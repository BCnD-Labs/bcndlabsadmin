import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, View, type LayoutRectangle } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { SettingsHandle } from "./src/components/SettingsHandle.tsx"
import { clearAddress, loadAddress, loadViewMode, saveAddress, saveViewMode } from "./src/lib/storage.ts"
import { sanitizeViewMode, type ViewMode } from "./src/lib/view-mode.ts"
import { useUpdateCheck } from "./src/lib/use-update-check.ts"
import { NativeHome } from "./src/native/index.ts"
import { SettingsScreen } from "./src/screens/SettingsScreen.tsx"
import { SetupScreen } from "./src/screens/SetupScreen.tsx"
import { WebScreen, type WebScreenHandle } from "./src/screens/WebScreen.tsx"
import { color } from "./src/theme.ts"

void SplashScreen.preventAutoHideAsync().catch(() => {})

type Boot = { status: "loading" } | { status: "setup" } | { status: "ready"; address: string; viewMode: ViewMode }

/**
 * App root. First launch → setup (address). Then the main area renders by view mode:
 * "web" → the hosted Blackwall in a WebView (the only one built); "native" → NativeHome
 * once it exists. Settings is a native modal over either, opened from the edge handle.
 */
export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: "loading" })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [area, setArea] = useState<LayoutRectangle | null>(null)
  const web = useRef<WebScreenHandle>(null)
  const update = useUpdateCheck(boot.status === "ready" ? boot.address : null)
  const updateAvailable = update.result !== null && update.result !== "checking" && update.result.status === "available"

  useEffect(() => {
    void (async () => {
      const [address, mode] = await Promise.all([loadAddress(), loadViewMode()])
      setBoot(address ? { status: "ready", address, viewMode: sanitizeViewMode(mode, NativeHome != null) } : { status: "setup" })
      await SplashScreen.hideAsync().catch(() => {})
    })()
  }, [])

  const openSettings = useCallback(() => setSettingsOpen(true), [])

  const onSaved = async (url: string) => {
    await saveAddress(url)
    setBoot({ status: "ready", address: url, viewMode: sanitizeViewMode(await loadViewMode(), NativeHome != null) })
  }

  let body = null
  if (boot.status === "setup") {
    body = <SetupScreen onSaved={onSaved} />
  } else if (boot.status === "ready") {
    const Native = boot.viewMode === "native" ? NativeHome : null
    body = (
      <SafeAreaView style={styles.flex} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.flex} onLayout={(e) => setArea(e.nativeEvent.layout)}>
          {Native ? <Native address={boot.address} onOpenSettings={openSettings} /> : <WebScreen ref={web} startUrl={boot.address} onOpenSettings={openSettings} />}
          <SettingsHandle area={area} onOpen={openSettings} badge={updateAvailable} reserveBottom={Native ? 96 : 0} />
        </View>
        <SettingsScreen
          visible={settingsOpen}
          address={boot.address}
          viewMode={boot.viewMode}
          onClose={() => setSettingsOpen(false)}
          onChangeAddress={async (url) => {
            await saveAddress(url)
            setBoot({ ...boot, address: url })
          }}
          onClearAddress={async () => {
            await clearAddress()
            setSettingsOpen(false)
            setBoot({ status: "setup" })
          }}
          onViewMode={(mode) => {
            const next = sanitizeViewMode(mode, NativeHome != null)
            void saveViewMode(next)
            setBoot({ ...boot, viewMode: next })
          }}
          update={update.result}
          onCheckUpdate={() => void update.recheck()}
          onReload={() => web.current?.reload()}
          onClearSiteData={async () => {
            await web.current?.clearSiteData()
            setSettingsOpen(false)
          }}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar style="light" />
      {body}
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
  flex: { flex: 1, backgroundColor: color.ground },
})
