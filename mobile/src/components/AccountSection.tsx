import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputInstance } from "react-native"
import { sessionStatus, signIn, signOut, statusLabel, type SessionStatus } from "../lib/auth.ts"
import { color, mono } from "../theme.ts"
import { plannerColor as c } from "../native/planner-theme.ts"
import { Row, Section, rowStyles } from "./settings-ui.tsx"

type Props = {
  address: string
  /** True while Settings is open; the status is checked each time it opens. */
  active: boolean
  /** Called after a sign-in or sign-out took effect, so the web view can reload with the new cookie. */
  onSessionChanged: () => void
}

/**
 * Settings → Account. Signs in to your Blackwall server with its own password and shows
 * where you stand. The password lives only in the text field and a ref while you type: it is
 * sent once, then the field and the ref are emptied whether or not it worked. It is never
 * stored, logged or kept in React state.
 */
export function AccountSection({ address, active, onSessionChanged }: Props) {
  const [status, setStatus] = useState<SessionStatus | "checking">("checking")
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const password = useRef("")
  const input = useRef<TextInputInstance>(null)
  const latest = useRef(0)

  const check = useCallback(async (): Promise<SessionStatus> => {
    const mine = ++latest.current
    setStatus("checking")
    const s = await sessionStatus(address)
    if (mine === latest.current) setStatus(s)
    return s
  }, [address])

  useEffect(() => {
    if (active) void check()
  }, [active, check])

  const wipe = () => {
    password.current = ""
    input.current?.clear()
  }

  const submit = async () => {
    if (busy) return
    if (!password.current) return setError("Enter your password.")
    setBusy(true)
    setError(null)
    const result = await signIn(address, password.current, remember)
    wipe()
    if (!result.ok) {
      setError(result.reason)
      return setBusy(false)
    }
    // Confirm the server sees the cookie before reloading the page: the proof it was kept.
    const now = await check()
    if (now === "signed-in" || now === "no-login-needed") onSessionChanged()
    else setError(now === "signed-out" ? "The server accepted the password, but this phone didn't keep the sign-in. Try again." : "Signed in, but then lost the connection. Check again.")
    setBusy(false)
  }

  const leave = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await signOut(address)
    if (!result.ok) setError(result.reason)
    else {
      await check()
      onSessionChanged()
    }
    setBusy(false)
  }

  const label = status === "checking" ? { title: "Checking…", hint: "Asking your Blackwall server." } : statusLabel(status)
  const checking = status === "checking"

  return (
    <Section title="Account">
      <View style={rowStyles.block} accessibilityLiveRegion="polite">
        <Text style={rowStyles.rowLabel}>{label.title}</Text>
        <Text style={rowStyles.rowHint}>{label.hint}</Text>
      </View>
      {status === "signed-out" ? (
        <View style={rowStyles.block}>
          <TextInput
            ref={input}
            style={[styles.input, error ? styles.inputError : null]}
            onChangeText={(t) => {
              password.current = t
              if (error) setError(null)
            }}
            placeholder="Password"
            placeholderTextColor={color.faint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType="go"
            editable={!busy}
            onSubmitEditing={() => void submit()}
            accessibilityLabel="Blackwall password"
          />
          <View style={styles.remember}>
            <View style={styles.flex}>
              <Text style={rowStyles.rowLabel}>Keep me signed in</Text>
              <Text style={rowStyles.rowHint}>{remember ? "For 30 days." : "For about 12 hours."}</Text>
            </View>
            <Switch value={remember} onValueChange={setRemember} disabled={busy} trackColor={{ false: color.well, true: c.action }} thumbColor={color.text} accessibilityLabel="Keep me signed in" />
          </View>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void submit()}
            disabled={busy}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && rowStyles.disabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
          >
            <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>
      ) : null}
      {status === "signed-in" ? <Row label={busy ? "Signing out…" : "Sign out"} hint="Ends the session for the web view and native screens" onPress={() => void leave()} destructive disabled={busy} /> : null}
      {error && status !== "signed-out" ? (
        <Text style={[styles.error, styles.rowError]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Row label={checking ? "Checking…" : "Check again"} onPress={() => void check()} disabled={checking || busy} />
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  input: { minHeight: 36, borderWidth: 1, borderColor: color.border, borderRadius: 11, backgroundColor: color.well, color: color.text, paddingHorizontal: 10, fontSize: 13, fontFamily: mono },
  inputError: { borderColor: color.errorText },
  remember: { flexDirection: "row", alignItems: "center", gap: 12 },
  error: { color: color.errorText, fontSize: 13, lineHeight: 18 },
  rowError: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color.line },
  button: { minHeight: 30, borderRadius: 16, alignSelf: "flex-end", paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.action },
  buttonPressed: { backgroundColor: c.actionPressed },
  buttonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
})
