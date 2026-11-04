import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { normalizeAddress } from "../lib/url.ts"
import { color, mono } from "../theme.ts"
import { plannerColor as c } from "../native/planner-theme.ts"

type Props = {
  initial?: string
  submitLabel: string
  onSubmit: (url: string) => void | Promise<void>
  onCancel?: () => void
}

/** The Blackwall address field with validation, shared by first-run setup and Settings. */
export function AddressForm({ initial = "", submitLabel, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const r = normalizeAddress(value)
    if (!r.ok) return setError(r.error)
    setError(null)
    setBusy(true)
    try {
      await onSubmit(r.url)
    } catch (e) {
      setError(`Couldn't save the address: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={(t) => {
          setValue(t)
          if (error) setError(null)
        }}
        placeholder="https://blackwall.example.ts.net"
        placeholderTextColor={color.faint}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        keyboardType="url"
        inputMode="url"
        returnKeyType="go"
        importantForAutofill="no"
        onSubmitEditing={submit}
        accessibilityLabel="Blackwall address"
        accessibilityHint="Your Blackwall server's https address"
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={styles.row}>
        {onCancel ? (
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.button, styles.quiet, pressed && styles.quietPressed]} accessibilityRole="button">
            <Text style={styles.quietText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={submit}
          disabled={busy || !value.trim()}
          style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed, (busy || !value.trim()) && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !value.trim(), busy }}
        >
          <Text style={styles.primaryText}>{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  input: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 11,
    backgroundColor: color.well,
    color: color.text,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: mono,
  },
  inputError: { borderColor: color.errorText },
  error: { color: color.errorText, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  button: { minHeight: 29, paddingHorizontal: 12, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: c.action },
  primaryPressed: { backgroundColor: c.actionPressed },
  primaryText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  quiet: { borderWidth: 1, borderColor: color.border },
  quietPressed: { backgroundColor: color.raised },
  quietText: { color: color.text, fontSize: 12 },
  disabled: { opacity: 0.5 },
})
