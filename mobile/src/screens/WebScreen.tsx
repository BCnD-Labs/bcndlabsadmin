import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { ActivityIndicator, Alert, BackHandler, Keyboard, Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { WebView as RNWebView, type WebViewNavigation } from "react-native-webview"
import type { ShouldStartLoadRequest, WebViewErrorEvent, WebViewHttpErrorEvent, WebViewMessageEvent, WebViewOpenWindowEvent } from "react-native-webview/lib/WebViewTypes"
import { clearNativeSiteData } from "../../modules/site-data/index.ts"
import { ErrorView, type LoadError } from "../components/ErrorView.tsx"
import { PULL_GUARD_SCRIPT, readPullMessage } from "../lib/bridge.ts"
import { classifyLink, originOf } from "../lib/url.ts"
import { color } from "../theme.ts"

// react-native-webview declares `class WebView<P = undefined>` with props `WebViewProps & P`;
// `& undefined` collapses to `never` under TypeScript 6, so instantiate it with an empty props extension.
const WebView = RNWebView<{}>
type WebView = InstanceType<typeof WebView>

export type WebScreenHandle = {
  reload: () => void
  /** Signs out and clears this app's cookies, storage, service worker and cache, then starts fresh. */
  clearSiteData: () => Promise<{ native: boolean }>
}

const LOAD_TIMEOUT_MS = 30_000

/** Best-effort sign-out and cleanup from inside the page, run before the native wipe. */
const PAGE_CLEANUP_SCRIPT = `(async () => {
  try { await fetch("/api/logout", { method: "POST", headers: { "X-Blackwall": "1" }, credentials: "same-origin" }) } catch (e) {}
  try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister() } catch (e) {}
  try { for (const k of await caches.keys()) await caches.delete(k) } catch (e) {}
  try { localStorage.clear(); sessionStorage.clear() } catch (e) {}
  try { for (const d of await indexedDB.databases()) if (d.name) indexedDB.deleteDatabase(d.name) } catch (e) {}
})(); true;`

/** Opens another app (mailto:, tel:, obsidian://…) only after you confirm. */
export function confirmAppLink(url: string) {
  const scheme = url.slice(0, url.indexOf(":"))
  Alert.alert("Open in another app?", `This link opens outside Blackwall (${scheme}:).\n\n${url.slice(0, 200)}`, [
    { text: "Cancel", style: "cancel" },
    { text: "Open", onPress: () => void Linking.openURL(url).catch(() => Alert.alert("No app can open this link.")) },
  ])
}

type Props = { startUrl: string; onOpenSettings: () => void }

/**
 * Full-screen WebView of your hosted Blackwall. Only your Blackwall's origin loads in the
 * app; other web links open in the default browser; app links ask first; everything else
 * is blocked. No file access, no mixed content, no geolocation; the app requests no camera,
 * microphone or location permissions, so the page can't get them.
 */
export const WebScreen = forwardRef<WebScreenHandle, Props>(function WebScreen({ startUrl, onOpenSettings }, ref) {
  const origin = originOf(startUrl) ?? ""
  const web = useRef<WebView>(null)
  const [instance, setInstance] = useState(0) // bump to remount with a fresh start
  const [source, setSource] = useState({ uri: startUrl })
  const [error, setError] = useState<LoadError | null>(null)
  const [firstLoadDone, setFirstLoadDone] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullAllowed, setPullAllowed] = useState(false)
  const [keyboard, setKeyboard] = useState(0)
  const canGoBack = useRef(false)
  const currentUrl = useRef(startUrl)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const restart = useCallback((url: string) => {
    clearTimer()
    setError(null)
    setFirstLoadDone(false)
    canGoBack.current = false
    setSource({ uri: url })
    setInstance((n) => n + 1)
  }, [])

  // A new address from Settings starts over on it (not on first mount, which already loads it).
  const shownUrl = useRef(startUrl)
  useEffect(() => {
    if (shownUrl.current === startUrl) return
    shownUrl.current = startUrl
    restart(startUrl)
  }, [startUrl, restart])

  // Back goes back in the page's history; at the start, Android's default (leave the app).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (error) return false
      if (canGoBack.current) {
        web.current?.goBack()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [error])

  // Edge-to-edge Android doesn't resize the window for the keyboard; make room ourselves.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  useEffect(() => clearTimer, [])

  useImperativeHandle(
    ref,
    () => ({
      reload: () => (error ? restart(currentUrl.current) : web.current?.reload()),
      clearSiteData: async () => {
        if (!error && originOf(currentUrl.current) === origin) {
          web.current?.injectJavaScript(PAGE_CLEANUP_SCRIPT)
          await new Promise((r) => setTimeout(r, 1500))
        }
        web.current?.clearCache?.(true)
        web.current?.clearHistory?.()
        const native = await clearNativeSiteData().catch(() => false)
        restart(startUrl)
        return { native }
      },
    }),
    [error, origin, restart, startUrl],
  )

  const fail = useCallback((e: LoadError) => {
    clearTimer()
    setRefreshing(false)
    setError(e)
  }, [])

  const route = useCallback(
    (url: string): boolean => {
      switch (classifyLink(url, origin)) {
        case "load":
          return true
        case "browser":
          void Linking.openURL(url).catch(() => Alert.alert("Couldn't open the browser."))
          return false
        case "app":
          confirmAppLink(url)
          return false
        default:
          return false
      }
    },
    [origin],
  )

  const onShouldStart = useCallback(
    (req: ShouldStartLoadRequest) => {
      // Android only asks for top-frame navigations; iframes (such as the CMS page previews) are page content.
      if (req.isTopFrame === false) return classifyLink(req.url, origin) !== "block"
      return route(req.url)
    },
    [origin, route],
  )

  const onOpenWindow = useCallback(
    (e: WebViewOpenWindowEvent) => {
      // target=_blank and window.open follow the same rules; in-app ones open in place.
      const url = e.nativeEvent.targetUrl
      if (classifyLink(url, origin) === "load") setSource({ uri: url })
      else route(url)
    },
    [origin, route],
  )

  const onNavigationStateChange = (s: WebViewNavigation) => {
    canGoBack.current = s.canGoBack
    if (s.url) currentUrl.current = s.url
  }

  const onLoadStart = () => {
    if (!timer.current && !firstLoadDone) {
      timer.current = setTimeout(
        () => fail({ title: "Blackwall isn't answering", detail: `Nothing came back within ${LOAD_TIMEOUT_MS / 1000} seconds.`, url: currentUrl.current }),
        LOAD_TIMEOUT_MS,
      )
    }
  }

  const onLoadEnd = () => {
    clearTimer()
    setRefreshing(false)
    setFirstLoadDone(true)
  }

  const onError = (e: WebViewErrorEvent) => {
    const { description, code, url } = e.nativeEvent
    fail({ title: "Can't reach Blackwall", detail: description || "The page couldn't be loaded.", url: url || currentUrl.current, code: code != null ? `Error ${code}` : undefined })
  }

  const onHttpError = (e: WebViewHttpErrorEvent) => {
    const { statusCode, url } = e.nativeEvent
    // 5xx from the main document (e.g. Tailscale Serve with Blackwall stopped) means the server isn't there.
    if (statusCode >= 500 && originOf(url) === origin) {
      fail({ title: "Blackwall isn't responding", detail: `The server answered with HTTP ${statusCode}.`, url, code: `HTTP ${statusCode}` })
    }
  }

  const onMessage = (e: WebViewMessageEvent) => {
    const allowed = readPullMessage(e.nativeEvent.data, e.nativeEvent.url, origin)
    if (allowed !== null) setPullAllowed(allowed)
  }

  const onRefresh = () => {
    setRefreshing(true)
    web.current?.reload()
  }

  return (
    <View style={[styles.flex, { paddingBottom: keyboard }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.flex}
        scrollEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={pullAllowed && firstLoadDone && !error}
            colors={[color.red]}
            progressBackgroundColor={color.panel}
          />
        }
      >
        <WebView
          key={instance}
          ref={web}
          source={source}
          style={styles.web}
          containerStyle={styles.web}
          // Every navigation goes through onShouldStart. Without "*", URLs outside the list are
          // handed to Linking.openURL unchecked (including intent: and other schemes).
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={onShouldStart}
          setSupportMultipleWindows
          onOpenWindow={onOpenWindow}
          javaScriptEnabled
          domStorageEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          geolocationEnabled={false}
          thirdPartyCookiesEnabled={false}
          allowsProtectedMedia={false}
          mediaPlaybackRequiresUserAction
          cacheEnabled
          injectedJavaScript={PULL_GUARD_SCRIPT}
          injectedJavaScriptForMainFrameOnly
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          onError={onError}
          onHttpError={onHttpError}
          onRenderProcessGone={() => fail({ title: "The page stopped working", detail: "Android ended the page's process. Retry to load it again.", url: currentUrl.current })}
          webviewDebuggingEnabled={__DEV__}
          overScrollMode="never"
          setBuiltInZoomControls={false}
        />
      </ScrollView>
      {!firstLoadDone && !error ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color={color.muted} accessibilityLabel="Loading Blackwall" />
        </View>
      ) : null}
      {error ? <ErrorView error={error} onRetry={() => restart(currentUrl.current)} onSettings={onOpenSettings} /> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  flex: { flex: 1 },
  web: { flex: 1, backgroundColor: color.ground },
  loading: { ...StyleSheet.absoluteFill, backgroundColor: color.ground, alignItems: "center", justifyContent: "center" },
})
