import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { createTask } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { dueText } from "./rows.ts"
import { buildQuickAdd, editAccess, previewQuickAdd, resolveWithin } from "./task-form.ts"

/**
 * One text field at the top of the Tasks tab. "Read ch 4 tomorrow" becomes a task titled
 * "Read ch 4" due tomorrow (the shared parseQuickAdd, same as the web). On the Today tab a task
 * without a date word is due today, as on the web. The text stays if the add is refused.
 */
export function QuickAdd({ today, defaultDue }: { today: string; defaultDue?: string }) {
  const { status, data, mutate, message } = useWorkspace()
  const [text, setText] = useState("")
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const access = editAccess(status, !!data)
  const preview = previewQuickAdd(text, today, defaultDue)

  async function submit() {
    const next = buildQuickAdd(text, today, defaultDue)
    if (!next || busy || !access.ok) return
    setBusy(true)
    const ok = await resolveWithin(mutate(["tasks"], (d) => createTask(d, next).data), 1500, true)
    setBusy(false)
    setFailed(!ok)
    if (ok) setText("")
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={(t) => (setText(t), setFailed(false))}
          onSubmitEditing={() => void submit()}
          submitBehavior="submit"
          editable={access.ok}
          placeholder={access.ok ? "Add a task, e.g. Read ch 4 tomorrow" : "Adding is paused"}
          placeholderTextColor={color.faint}
          accessibilityLabel="Add a task"
          returnKeyType="done"
          style={styles.input}
        />
        <Pressable
          onPress={() => void submit()}
          disabled={!preview || !access.ok || busy}
          style={[styles.add, (!preview || !access.ok || busy) && styles.addOff]}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          accessibilityState={{ disabled: !preview || !access.ok || busy }}
        >
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {!access.ok ? <Text style={styles.hint}>{access.reason}</Text> : null}
      {access.ok && failed ? <Text style={styles.error}>{message ?? "That couldn't be added."}</Text> : null}
      {access.ok && !failed && preview ? <Text style={styles.hint} numberOfLines={1}>{`Adds "${preview.title}"${preview.due ? ` · due ${dueText(preview.due, false)}` : ""}`}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.panel, color: color.text, paddingHorizontal: 14, fontSize: 15 },
  add: { minWidth: 64, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: color.red, paddingHorizontal: 14 },
  addOff: { opacity: 0.4 },
  addText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  hint: { color: color.muted, fontSize: 12 },
  error: { color: color.errorText, fontSize: 12 },
})
