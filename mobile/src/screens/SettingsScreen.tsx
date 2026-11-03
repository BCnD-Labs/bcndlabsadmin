import Constants from "expo-constants"
import { useState, type ReactNode } from "react"
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AddressForm } from "../components/AddressForm.tsx"
import { checkForUpdate, type UpdateResult } from "../lib/app-update.ts"
import { VIEW_MODES, type ViewMode } from "../lib/view-mode.ts"
import { color, mono } from "../theme.ts"

type Props = {
  visible: boolean
  address: string
  viewMode: ViewMode
  onClose: () => void
  onChangeAddress: (url: string) => Promise<void>
  onClearAddress: () => Promise<void>
  onViewMode: (mode: ViewMode) => void
  onReload: () => void
  onClearSiteData: () => Promise<void>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function Row({ label, hint, onPress, destructive, disabled }: { label: string; hint?: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={hint}
    >
      <Text style={[styles.rowLabel, destructive && styles.destructive]}>{label}</Text>
      {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
    </Pressable>
  )
}

/** Native Settings: address, view mode, reload, clear site data, version. */
export function SettingsScreen(p: Props) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [update, setUpdate] = useState<UpdateResult | "checking" | null>(null)
  const version = Constants.expoConfig?.version ?? "?"
  const build = Constants.expoConfig?.android?.versionCode

  const checkUpdate = async () => {
    setUpdate("checking")
    setUpdate(await checkForUpdate(p.address, build ?? 1))
  }
  const updateText =
    update === "checking"
      ? "Checking…"
      : update === null
        ? "Asks your Blackwall server for a newer Android build."
        : update.status === "current"
          ? "You're on the newest build."
          : update.status === "available"
            ? `Version ${update.manifest.versionName} (build ${update.manifest.versionCode}) is ready.${update.manifest.notes ? ` ${update.manifest.notes}` : ""}`
            : update.reason

  const close = () => {
    setEditing(false)
    p.onClose()
  }

  const clearAddress = () =>
    Alert.alert("Clear the address?", "The app will ask for your Blackwall address again. Your sign-in on the page isn't affected.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => void p.onClearAddress() },
    ])

  const clearSiteData = () =>
    Alert.alert(
      "Clear site data and sign out?",
      "Signs you out and removes this app's cookies, saved page data, offline copy and cache. Unsynced edits that only exist on this phone are lost. Your Blackwall server data isn't touched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear and sign out",
          style: "destructive",
          onPress: async () => {
            setBusy(true)
            try {
              await p.onClearSiteData()
            } finally {
              setBusy(false)
            }
          },
        },
      ],
    )

  return (
    <Modal visible={p.visible} animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Settings
          </Text>
          <Pressable onPress={close} style={({ pressed }) => [styles.done, pressed && styles.rowPressed]} accessibilityRole="button" accessibilityLabel="Close settings">
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Section title="Server">
            <View style={styles.block}>
              <Text style={styles.label}>Blackwall address</Text>
              {editing ? (
                <AddressForm
                  initial={p.address}
                  submitLabel="Save"
                  autoFocus
                  onCancel={() => setEditing(false)}
                  onSubmit={async (url) => {
                    await p.onChangeAddress(url)
                    setEditing(false)
                    close()
                  }}
                />
              ) : (
                <Text style={styles.address} selectable>
                  {p.address}
                </Text>
              )}
              <Text style={styles.rowHint}>Saved only on this phone.</Text>
            </View>
            {!editing ? (
              <>
                <Row label="Change address" onPress={() => setEditing(true)} />
                <Row label="Clear address" onPress={clearAddress} destructive />
              </>
            ) : null}
          </Section>

          <Section title="View mode">
            <View accessibilityRole="radiogroup">
              {VIEW_MODES.map((m) => {
                const selected = p.viewMode === m.mode
                return (
                  <Pressable
                    key={m.mode}
                    onPress={() => m.available && p.onViewMode(m.mode)}
                    disabled={!m.available}
                    style={({ pressed }) => [styles.row, styles.radioRow, pressed && m.available && styles.rowPressed, !m.available && styles.disabled]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !m.available }}
                    accessibilityHint={m.note}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.flex}>
                      <Text style={styles.rowLabel}>{m.label}</Text>
                      {m.note ? <Text style={styles.rowHint}>{m.note}</Text> : null}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </Section>

          <Section title="Page">
            <Row
              label="Reload"
              onPress={() => {
                p.onReload()
                close()
              }}
            />
            <Row label={busy ? "Clearing…" : "Clear site data and sign out"} onPress={clearSiteData} destructive disabled={busy} />
          </Section>

          <Section title="App update">
            <View style={styles.block}>
              <Text style={styles.rowHint}>{updateText}</Text>
            </View>
            <Row label={update === "checking" ? "Checking…" : "Check for update"} onPress={() => void checkUpdate()} disabled={update === "checking"} />
            {update && update !== "checking" && update.status === "available" ? (
              <Row label="Download and install" hint="Opens the download; tap the file when it finishes" onPress={() => void Linking.openURL(update.url)} />
            ) : null}
          </Section>

          <Section title="About">
            <View style={styles.block}>
              <Text style={styles.rowLabel}>Blackwall for Android</Text>
              <Text style={styles.rowHint}>
                Version {version}
                {build ? ` (build ${build})` : ""}
              </Text>
            </View>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ground },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.line },
  title: { color: color.text, fontSize: 20, fontWeight: "700" },
  done: { minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  doneText: { color: color.text, fontSize: 16, fontWeight: "600" },
  scroll: { padding: 16, gap: 20, maxWidth: 640, width: "100%", alignSelf: "center" },
  section: { gap: 8 },
  sectionTitle: { color: color.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  card: { backgroundColor: color.panel, borderColor: color.edge, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  block: { padding: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: color.line },
  label: { color: color.text2, fontSize: 13 },
  address: { color: color.text, fontFamily: mono, fontSize: 14 },
  row: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: color.line },
  rowPressed: { backgroundColor: color.raised },
  rowLabel: { color: color.text, fontSize: 15 },
  rowHint: { color: color.muted, fontSize: 12, marginTop: 2 },
  destructive: { color: color.errorText },
  disabled: { opacity: 0.5 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.muted, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: color.red },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.red },
})
