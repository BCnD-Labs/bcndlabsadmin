import Constants from "expo-constants"
import { useState } from "react"
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AccountSection } from "../components/AccountSection.tsx"
import { AddressForm } from "../components/AddressForm.tsx"
import { Row, Section, rowStyles } from "../components/settings-ui.tsx"
import { downloadAndInstall } from "../lib/app-installer.ts"
import type { UpdateResult } from "../lib/app-update.ts"
import { VIEW_MODES, type ViewMode } from "../lib/view-mode.ts"
import { color, mono } from "../theme.ts"
import { plannerColor as c } from "../native/planner-theme.ts"

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
  /** Result of the server check (null until it has run). */
  update: UpdateResult | "checking" | null
  onCheckUpdate: () => void
  /** Called after signing in or out here, so the web view reloads with the new cookie. */
  onSessionChanged: () => void
}

/** Native Settings: address, account, view mode, reload, clear site data, version. */
export function SettingsScreen(p: Props) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [install, setInstall] = useState<{ phase: "downloading"; pct: number } | { phase: "opening" } | { phase: "error"; reason: string } | null>(null)
  const version = Constants.expoConfig?.version ?? "?"
  const build = Constants.expoConfig?.android?.versionCode

  const update = p.update
  const available = update && update !== "checking" && update.status === "available" ? update : null
  const installing = install?.phase === "downloading"

  const startInstall = async () => {
    if (!available || installing) return
    setInstall({ phase: "downloading", pct: 0 })
    const done = await downloadAndInstall(available.manifest, available.url, (pct) => setInstall({ phase: "downloading", pct }))
    setInstall(done.ok ? { phase: "opening" } : { phase: "error", reason: done.reason })
  }

  const updateText = install
    ? install.phase === "downloading"
      ? `Downloading… ${install.pct}%`
      : install.phase === "opening"
        ? "Android's installer is open. Tap Update there, then reopen Blackwall."
        : install.reason
    : update === "checking"
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
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.backdrop}><SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Blackwall <Text style={styles.breadcrumb}>/ Settings</Text>
          </Text>
          <Pressable onPress={close} style={({ pressed }) => [styles.done, pressed && styles.rowPressed]} accessibilityRole="button" accessibilityLabel="Close settings">
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

          <AccountSection address={p.address} active={p.visible} onSessionChanged={p.onSessionChanged} />

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
            <View style={styles.block} accessibilityLiveRegion="polite">
              <Text style={styles.rowHint}>{updateText}</Text>
              {install?.phase === "downloading" ? (
                <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: install.pct }}>
                  <View style={[styles.fill, { width: `${install.pct}%` }]} />
                </View>
              ) : null}
            </View>
            {available ? (
              <Row
                label={installing ? "Downloading…" : `Update to ${available.manifest.versionName}`}
                hint="Downloads here, then Android asks to install"
                onPress={() => void startInstall()}
                disabled={installing}
              />
            ) : null}
            <Row label={update === "checking" ? "Checking…" : "Check for update"} onPress={p.onCheckUpdate} disabled={update === "checking" || installing} />
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
      </SafeAreaView></View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  ...rowStyles,
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" },
  safe: { width: "92%", maxWidth: 560, maxHeight: "88%", backgroundColor: c.panel, borderColor: c.border, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  scrollView: { flexGrow: 0, flexShrink: 1 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, minHeight: 38, borderBottomWidth: 1, borderBottomColor: c.line },
  title: { color: c.text, fontSize: 14, fontWeight: "600" }, breadcrumb: { color: c.muted, fontWeight: "400" },
  done: { minHeight: 27, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: c.raised },
  doneText: { color: c.text2, fontSize: 12, fontWeight: "600" },
  scroll: { padding: 12, gap: 13, paddingBottom: 16 },
  label: { color: color.text2, fontSize: 13 },
  address: { color: color.text, fontFamily: mono, fontSize: 14 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.muted, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: c.accent },
  track: { height: 6, borderRadius: 3, backgroundColor: color.well, overflow: "hidden" },
  fill: { height: 6, backgroundColor: c.blue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.blue },
})
