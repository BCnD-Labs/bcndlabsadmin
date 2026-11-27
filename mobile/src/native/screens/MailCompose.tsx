import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { draftProblem, draftTouched, outgoing, type MailDraft } from "../../lib/mail-compose.ts"
import { sendMail } from "../../lib/mail-client.ts"
import { formatSize } from "../../lib/shared.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { WorkspaceSection } from "../WorkspacePage.tsx"
import { Pill, SmallButton } from "./learning/LearningControls.tsx"

/** Write, reply or forward. Nothing is stored on the phone or saved to Proton's Drafts: leaving an edited draft asks first. */
export function MailCompose({ address, start, addresses, onClose, onSent }: { address: string; start: MailDraft; addresses: string[]; onClose: () => void; onSent: () => void }) {
  const [draft, setDraft] = useState(start)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const set = (patch: Partial<MailDraft>) => { setDraft(d => ({ ...d, ...patch })); setError(null) }

  const send = async () => {
    const problem = draftProblem(draft)
    if (problem) { setError(problem); return }
    setSending(true)
    const result = await sendMail(address, outgoing(draft))
    setSending(false)
    if (result.ok) onSent(); else setError(`Not sent. ${result.message}`)
  }
  const leave = () => { if (draftTouched(draft, start) && !confirmLeave) setConfirmLeave(true); else onClose() }
  const field = (label: string, key: "to" | "cc" | "subject", keyboardType?: "email-address") =>
    <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={draft[key]} onChangeText={v => set({ [key]: v })} style={s.input} editable={!sending} autoCapitalize="none" autoCorrect={false} keyboardType={keyboardType} accessibilityLabel={label} /></View>

  return <WorkspaceSection title={draft.reply ? (draft.reply.mode === "forward" ? "Forward" : "Reply") : "New message"} icon="create-outline">
    {addresses.length > 1 ? <View style={s.field}><Text style={s.label}>From</Text><View style={s.pills}>{addresses.map(a => <Pill key={a} label={a} selected={draft.from === a} onPress={() => set({ from: a })} />)}</View></View> : null}
    {field("To", "to", "email-address")}{field("Cc", "cc", "email-address")}{field("Subject", "subject")}
    <TextInput value={draft.text} onChangeText={v => set({ text: v })} style={[s.input, s.body]} multiline textAlignVertical="top" editable={!sending} accessibilityLabel="Message" />
    {draft.forwarded.length ? <View style={s.field}><Text style={s.label}>Sent along</Text>{draft.forwarded.map(f => <Pressable key={f.index} onPress={() => set({ forwarded: draft.forwarded.filter(x => x.index !== f.index) })} accessibilityRole="button" accessibilityLabel={`Remove attachment ${f.name}`}><Text style={s.meta}>📎 {f.name} ({formatSize(f.size)}) — tap to remove</Text></Pressable>)}</View> : null}
    <Text style={s.meta}>Sending from Blackwall can't attach new files from the phone yet; use Web view for that.</Text>
    {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    {confirmLeave ? <Text style={s.error}>Discard this message? Tap Discard again to leave.</Text> : null}
    <View style={s.actions}><SmallButton label={sending ? "Sending…" : "Send"} onPress={() => { if (!sending) void send() }} /><SmallButton label={confirmLeave ? "Discard" : "Cancel"} onPress={leave} />{confirmLeave ? <SmallButton label="Keep writing" onPress={() => setConfirmLeave(false)} /> : null}</View>
  </WorkspaceSection>
}

const s = StyleSheet.create({
  field: { gap: 3 }, label: { color: c.muted, fontSize: 11 }, meta: { color: c.muted, fontSize: 11 }, error: { color: c.errorText, fontSize: 12 },
  input: { minHeight: 36, paddingHorizontal: 10, color: c.text, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, fontSize: 13 }, body: { minHeight: 180, paddingTop: 8, lineHeight: 19 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
})
