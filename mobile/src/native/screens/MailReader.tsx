import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { runMailAction, trashMail, type MailActionBody } from "../../lib/mail-client.ts"
import { groupFolders, type MailFolder, type MailMessage, type ReplyMode } from "../../lib/shared.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { WorkspaceSection } from "../WorkspacePage.tsx"
import { Pill, SmallButton } from "./learning/LearningControls.tsx"
import { MailAttachmentRow } from "./MailAttachments.tsx"

type Chooser = "move" | "label" | null

/**
 * One message with its actions. Nothing here deletes mail for good: the strongest action is a move to Trash.
 * `onChanged(leaves)` tells the screen to reload the list, and to close the message when it left this folder.
 */
export function MailReader({ address, folder, folders, message, onChanged, onReply, onUseWeb }: {
  address: string; folder: string; folders: MailFolder[]; message: MailMessage
  onChanged: (leaves: boolean, patch?: Partial<Pick<MailMessage, "unread" | "starred">>) => void; onReply: (mode: ReplyMode) => void; onUseWeb?: (path: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chooser, setChooser] = useState<Chooser>(null)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const body = message.text.slice(0, 200_000)
  const grouped = groupFolders(folders)
  const isInbox = folder.toUpperCase() === "INBOX"
  const web = onUseWeb ? () => onUseWeb("/mail") : undefined

  const act = async (run: () => ReturnType<typeof runMailAction>, leaves: boolean, patch?: Partial<Pick<MailMessage, "unread" | "starred">>) => {
    setBusy(true); setError(null); setChooser(null); setConfirmTrash(false)
    const r = await run()
    setBusy(false)
    if (r.ok) onChanged(leaves, patch); else setError(r.message)
  }
  const go = (body: Omit<MailActionBody, "uids">, leaves: boolean, patch?: Partial<Pick<MailMessage, "unread" | "starred">>) => act(() => runMailAction(address, folder, { uids: [message.uid], ...body }), leaves, patch)
  const targets = chooser === "label" ? grouped.labels : [...grouped.system.filter(f => f.path !== folder), ...grouped.folders]

  return <WorkspaceSection title={message.subject} icon="mail-open-outline">
    <Text style={s.sender}>{message.from}</Text><Text style={s.meta}>To: {message.to}</Text>{message.cc ? <Text style={s.meta}>Cc: {message.cc}</Text> : null}<Text style={s.meta}>{new Date(message.date).toLocaleString()}</Text>
    <View style={s.actions}>
      <SmallButton label="Reply" onPress={() => onReply("reply")} /><SmallButton label="Reply all" onPress={() => onReply("replyAll")} /><SmallButton label="Forward" onPress={() => onReply("forward")} />
    </View>
    <View style={s.actions} accessibilityState={{ busy }}>
      <SmallButton label={message.unread ? "Mark read" : "Mark unread"} onPress={() => void go({ action: message.unread ? "read" : "unread" }, false, { unread: !message.unread })} />
      <SmallButton label={message.starred ? "Unstar" : "Star"} onPress={() => void go({ action: message.starred ? "unstar" : "star" }, false, { starred: !message.starred })} />
      {!isInbox ? <SmallButton label="Move to Inbox" onPress={() => void go({ action: "inbox" }, true)} /> : null}
      <SmallButton label="Archive" onPress={() => void go({ action: "archive" }, true)} /><SmallButton label="Spam" onPress={() => void go({ action: "spam" }, true)} />
      <SmallButton label="Move…" onPress={() => setChooser(chooser === "move" ? null : "move")} /><SmallButton label="Label…" onPress={() => setChooser(chooser === "label" ? null : "label")} />
      <SmallButton label={confirmTrash ? "Move to Trash?" : "Trash"} onPress={() => { if (confirmTrash) void act(() => trashMail(address, folder, message.uid), true); else setConfirmTrash(true) }} />
    </View>
    {chooser ? <View style={s.chooser}><Text style={s.meta}>{chooser === "label" ? "Add a label (the message stays where it is)" : "Move to"}</Text>
      {targets.length ? <View style={s.actions}>{targets.map(f => <Pill key={f.path} label={f.name} selected={false} onPress={() => void go({ action: chooser, target: f.path }, chooser === "move")} />)}</View> : <Text style={s.meta}>{chooser === "label" ? "You have no labels yet." : "No other folders."}</Text>}</View> : null}
    {confirmTrash ? <Text style={s.meta}>Trash keeps the message in Proton's Trash; nothing is deleted for good.</Text> : null}
    {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <View style={s.body}><Text style={s.bodyText} selectable>{body || "This message has no plain-text version."}</Text></View>
    {message.text.length > body.length ? <Text style={s.meta}>Showing the first 200,000 characters. Open Web view for the rest.</Text> : null}
    {message.attachments.some(a => !a.inline) ? <View style={s.attachments}><Text style={s.heading}>Attachments</Text>
      {message.attachments.filter(a => !a.inline).map(a => <MailAttachmentRow key={a.index} address={address} folder={folder} uid={message.uid} attachment={a} onUseWeb={web} />)}</View> : null}
    {message.html && !body && web ? <SmallButton label="Open in Web view" onPress={web} /> : null}
  </WorkspaceSection>
}

const s = StyleSheet.create({
  meta: { color: c.muted, fontSize: 11 }, error: { color: c.errorText, fontSize: 12 }, sender: { color: c.text2, fontSize: 13 }, heading: { color: c.text, fontWeight: "700", fontSize: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }, chooser: { gap: 6, paddingTop: 6 },
  body: { paddingVertical: 12 }, bodyText: { color: c.text2, fontSize: 13, lineHeight: 20 }, attachments: { borderTopWidth: 1, borderColor: c.line, paddingVertical: 8, gap: 5 },
})
