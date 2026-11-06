import { shape } from "../shape.ts"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color, mono } from "../theme.ts"

export type LoadError = { title: string; detail: string; url: string; code?: string }

/** Shown over the WebView when your Blackwall can't be reached. */
export function ErrorView({ error, onRetry, onSettings }: { error: LoadError; onRetry: () => void; onSettings: () => void }) {
  return (
    <View style={styles.wrap} accessibilityViewIsModal>
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          {error.title}
        </Text>
        <Text style={styles.detail}>{error.detail}</Text>
        <Text style={styles.hint}>Is Tailscale connected on this phone?</Text>
        <Text style={styles.url} numberOfLines={2} selectable>
          {error.url}
        </Text>
        {error.code ? <Text style={styles.code}>{error.code}</Text> : null}
        <View style={styles.row}>
          <Pressable onPress={onSettings} style={({ pressed }) => [styles.button, styles.quiet, pressed && styles.quietPressed]} accessibilityRole="button">
            <Text style={styles.quietText}>Change address</Text>
          </Pressable>
          <Pressable onPress={onRetry} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed]} accessibilityRole="button">
            <Text style={styles.primaryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, backgroundColor: color.ground, justifyContent: "center", padding: 16 },
  card: { backgroundColor: color.panel, borderColor: color.edge, borderWidth: 1, borderRadius: shape.card, padding: 20, gap: 10, maxWidth: 520, width: "100%", alignSelf: "center" },
  title: { color: color.text, fontSize: 19, fontWeight: "700" },
  detail: { color: color.text2, fontSize: 14, lineHeight: 20 },
  hint: { color: color.text, fontSize: 14, fontWeight: "600" },
  url: { color: color.muted, fontFamily: mono, fontSize: 13 },
  code: { color: color.faint, fontFamily: mono, fontSize: 12 },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8, flexWrap: "wrap" },
  button: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: color.red, minWidth: 96 },
  primaryPressed: { backgroundColor: color.redPressed },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  quiet: { borderWidth: 1, borderColor: color.border },
  quietPressed: { backgroundColor: color.raised },
  quietText: { color: color.text, fontSize: 15 },
})

