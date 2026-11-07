import { TextInput } from "../../editing/keyboard.tsx"
import { useState } from "react"
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native"
import { createTask } from "../../../lib/shared.ts"
import { plannerColor as color } from "../../planner-theme.ts"
import { shape } from "../../../shape.ts"
import { Icon, tone } from "../../ui.tsx"
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
  const [expanded, setExpanded] = useState(false)
  const access = editAccess(status, !!data)
  const preview = previewQuickAdd(text, today, defaultDue)

  async function submit() {
    const next = buildQuickAdd(text, today, defaultDue)
    if (!next || busy || !access.ok) return
    setBusy(true)
    const ok = await resolveWithin(mutate(["tasks"], (d) => createTask(d, next).data), 1500, true)
    setBusy(false)
    setFailed(!ok)
    if (ok) { setText(""); setExpanded(false); Keyboard.dismiss() }
  }

  return (
    <View style={styles.wrap}>
      {!expanded ? <Pressable onPress={() => setExpanded(true)} style={styles.opener} accessibilityRole="button" accessibilityLabel={text ? "Continue task draft" : "Quick add a task"} accessibilityState={{ expanded: false }}>
        <Icon name="add" size={16} tint={color.accent} />
        <Text style={styles.openerText}>{text ? "Continue task draft" : "Quick add a task"}</Text>
      </Pressable> : <>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={(t) => (setText(t), setFailed(false))}
          onSubmitEditing={() => void submit()}
          submitBehavior="submit"
          editable={access.ok}
          placeholder={access.ok ? "Add a task, e.g. Read ch 4 tomorrow" : "Adding is paused"}
          placeholderTextColor={color.muted}
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
        <Pressable onPress={() => { setExpanded(false); Keyboard.dismiss() }} style={styles.close} accessibilityRole="button" accessibilityLabel="Close quick add, keep draft"><Icon name="close" size={18} tint={color.muted} /></Pressable>
      </View>
      {!access.ok ? <Text style={styles.hint}>{access.reason}</Text> : null}
      {access.ok && failed ? <Text style={styles.error}>{message ?? "That couldn't be added."}</Text> : null}
      {access.ok && !failed && preview ? <Text style={styles.hint} numberOfLines={1}>{`Adds "${preview.title}"${preview.due ? ` · due ${dueText(preview.due, false)}` : ""}`}</Text> : null}
      </>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  opener: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, minHeight: 32, paddingHorizontal: 9, borderRadius: shape.card, backgroundColor: color.panel, borderWidth: 1, borderColor: color.line },
  openerText: { color: color.accent, fontSize: 11, fontWeight: "500" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: { flex: 1, minHeight: 40, borderRadius: shape.card, borderWidth: 1, borderColor: color.line, backgroundColor: color.panel, color: color.text, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14 },
  add: { minWidth: 44, minHeight: 40, borderRadius: shape.card, alignItems: "center", justifyContent: "center", backgroundColor: color.action, paddingHorizontal: 10 },
  addOff: { opacity: 0.4 },
  addText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  close: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  hint: { color: color.muted, fontSize: 11 },
  error: { color: tone.red, fontSize: 11 },
})

