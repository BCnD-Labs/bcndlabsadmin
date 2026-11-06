import { shape } from "../../../shape.ts"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { WebView as RNWebView, type WebViewNavigation } from "react-native-webview"
import type { ShouldStartLoadRequest, WebViewErrorEvent, WebViewHttpErrorEvent, WebViewOpenWindowEvent } from "react-native-webview/lib/WebViewTypes"
import { classifyLink, originOf } from "../../../lib/url.ts"
import { confirmAppLink } from "../../../screens/WebScreen.tsx"
import { plannerColor as c } from "../../planner-theme.ts"

// See WebScreen: react-native-webview's generic needs an empty props extension under TypeScript 6.
const WebView = RNWebView<{}>
type WebView = InstanceType<typeof WebView>

export type ToolHandle = {
  /** Goes back one page inside the tool. False when it is already on its first page (or failed to load). */
  goBack: () => boolean
  reload: () => void
}

const LOAD_TIMEOUT_MS = 30_000

/**
 * One Mikoshi tool in a WebView, locked to the tool's own address the same way WebScreen locks to Blackwall:
 * only that origin loads here; other web links open in the browser; app links ask first; everything else is
 * blocked. No file access, no mixed content, no geolocation. It stays mounted (hidden) while you use another tool.
 */
export const ToolWebView = forwardRef<ToolHandle, { url: string; name: string; visible: boolean }>(function ToolWebView({ url, name, visible }, ref) {
  const origin = originOf(url) ?? ""
  const web = useRef<WebView>(null)
  const [instance, setInstance] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<{ title: string; detail: string } | null>(null)
  const canBack = useRef(false)
  const current = useRef(url)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  useEffect(() => stop, [])

  const retry = useCallback(() => {
    stop()
    setError(null)
    setLoaded(false)
    canBack.current = false
    setInstance((n) => n + 1)
  }, [])
  const fail = useCallback((title: string, detail: string) => { stop(); setError({ title, detail }) }, [])

  useImperativeHandle(ref, () => ({
    goBack: () => { if (error || !canBack.current) return false; web.current?.goBack(); return true },
    reload: () => (error ? retry() : web.current?.reload()),
  }), [error, retry])

  const route = useCallback((target: string): boolean => {
    switch (classifyLink(target, origin)) {
      case "load": return true
      case "browser": void Linking.openURL(target).catch(() => Alert.alert("Couldn't open the browser.")); return false
      case "app": confirmAppLink(target); return false
      default: return false
    }
  }, [origin])
  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => (req.isTopFrame === false ? classifyLink(req.url, origin) !== "block" : route(req.url)), [origin, route])
  const onOpenWindow = useCallback((e: WebViewOpenWindowEvent) => { void route(e.nativeEvent.targetUrl) }, [route])

  return (
    <View style={[styles.fill, !visible && styles.hidden]}>
      <WebView
        key={instance}
        ref={web}
        source={{ uri: url }}
        style={styles.web}
        containerStyle={styles.web}
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
        onNavigationStateChange={(s: WebViewNavigation) => { canBack.current = s.canGoBack; if (s.url) current.current = s.url }}
        onLoadStart={() => { if (!timer.current && !loaded) timer.current = setTimeout(() => fail(`${name} isn't answering`, `Nothing came back within ${LOAD_TIMEOUT_MS / 1000} seconds.`), LOAD_TIMEOUT_MS) }}
        onLoadEnd={() => { stop(); setLoaded(true) }}
        onError={(e: WebViewErrorEvent) => fail(`Can't reach ${name}`, e.nativeEvent.description || "The page couldn't be loaded.")}
        onHttpError={(e: WebViewHttpErrorEvent) => { const { statusCode, url: at } = e.nativeEvent; if (statusCode >= 500 && originOf(at) === origin) fail(`${name} isn't responding`, `It answered HTTP ${statusCode}.`) }}
        onRenderProcessGone={() => fail(`${name} stopped working`, "Android ended the page's process. Retry to load it again.")}
        webviewDebuggingEnabled={__DEV__}
        overScrollMode="never"
        setBuiltInZoomControls={false}
      />
      {!loaded && !error ? <View style={styles.loading} pointerEvents="none"><ActivityIndicator size="large" color={c.muted} accessibilityLabel={`Loading ${name}`} /></View> : null}
      {error ? (
        <View style={styles.errorWrap}>
          <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">{error.title}</Text>
            <Text style={styles.detail}>{error.detail}</Text>
            <Text style={styles.hint}>Is Tailscale connected on this phone?</Text>
            <Text style={styles.url} numberOfLines={2} selectable>{url}</Text>
            <Pressable onPress={retry} style={styles.retry} accessibilityRole="button" accessibilityLabel={`Retry ${name}`}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  hidden: { display: "none" },
  web: { flex: 1, backgroundColor: c.ground },
  loading: { ...StyleSheet.absoluteFill, backgroundColor: c.ground, alignItems: "center", justifyContent: "center" },
  errorWrap: { ...StyleSheet.absoluteFill, backgroundColor: c.ground, justifyContent: "center", padding: 16 },
  card: { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: shape.card, padding: 16, gap: 8, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { color: c.text, fontSize: 16, fontWeight: "700" },
  detail: { color: c.text2, fontSize: 13, lineHeight: 19 },
  hint: { color: c.text, fontSize: 13, fontWeight: "600" },
  url: { color: c.muted, fontFamily: "monospace", fontSize: 12 },
  retry: { alignSelf: "flex-end", minHeight: 28, justifyContent: "center", paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.action },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "600" },
})

