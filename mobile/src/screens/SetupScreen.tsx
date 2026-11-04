import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AddressForm } from "../components/AddressForm.tsx"
import { color } from "../theme.ts"

/** First launch: ask for the Blackwall address. Nothing is built in; it's stored only on this phone. */
export function SetupScreen({ onSaved }: { onSaved: (url: string) => Promise<void> }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.mark} accessible={false}>
                <Text style={styles.markText}>BW</Text>
              </View>
              <Text style={styles.title} accessibilityRole="header">
                Set your Blackwall address
              </Text>
            </View>
            <Text style={styles.body}>
              Enter the https address of your Blackwall server, for example its Tailscale address. It's saved only on
              this phone, and you can change it later in Settings.
            </Text>
            <AddressForm submitLabel="Continue" onSubmit={onSaved} />
            <Text style={styles.note}>
              You sign in on the next screen, inside Blackwall itself. This app never stores your password.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ground },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 16 },
  card: {
    backgroundColor: color.panel,
    borderColor: color.edge,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 14,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mark: { width: 36, height: 36, borderRadius: 8, backgroundColor: color.red, alignItems: "center", justifyContent: "center" },
  markText: { color: "#fff", fontWeight: "700", fontSize: 13, letterSpacing: 1 },
  title: { color: color.text, fontSize: 20, fontWeight: "700", flexShrink: 1 },
  body: { color: color.text2, fontSize: 14, lineHeight: 20 },
  note: { color: color.muted, fontSize: 12, lineHeight: 17 },
})
