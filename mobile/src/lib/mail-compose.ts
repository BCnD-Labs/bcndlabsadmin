import { MAIL_MAX_ATTACHMENTS, MAIL_MAX_RECIPIENTS, quoteText, replyRecipients, splitAddresses, subjectFor, validAddress, type MailMessage, type OutgoingMail, type ReplyMode } from "./shared.ts"

/** A message being written on the phone. It lives in memory only; nothing is saved to Proton's Drafts. */
export type MailDraft = {
  from: string; to: string; cc: string; subject: string; text: string
  reply?: { folder: string; uid: number; mode: ReplyMode }
  /** Original attachments a forward sends along (indexes into the original message). */
  forwarded: { index: number; name: string; size: number }[]
}

export const blankDraft = (from: string): MailDraft => ({ from, to: "", cc: "", subject: "", text: "", forwarded: [] })

/** Reply, reply all or forward, with who it goes to and the quote filled in by the shared rules. */
export function replyDraft(mode: ReplyMode, message: MailMessage, folder: string, mine: string[], when: string): MailDraft {
  const { to, cc } = replyRecipients(message, mode, mine)
  // Answer from the address the message came to, when it is one of yours.
  const arrived = splitAddresses(`${message.to}, ${message.cc}`).map(a => a.address).find(a => mine.some(m => m.toLowerCase() === a.toLowerCase()))
  const from = mine.find(m => m.toLowerCase() === arrived?.toLowerCase()) ?? mine[0] ?? ""
  return {
    from, to, cc, subject: subjectFor(mode, message.subject), text: quoteText(mode, message, when),
    reply: { folder, uid: message.uid, mode },
    forwarded: mode === "forward" ? message.attachments.filter(a => !a.inline).map(({ index, name, size }) => ({ index, name, size })) : [],
  }
}

/** A short problem for the person writing, or null when the message can go. */
export function draftProblem(draft: MailDraft): string | null {
  const recipients = [draft.to, draft.cc].flatMap(splitAddresses)
  if (!recipients.length) return "Add at least one recipient."
  if (recipients.length > MAIL_MAX_RECIPIENTS) return `A message can go to ${MAIL_MAX_RECIPIENTS} people at most.`
  const bad = recipients.find(a => !validAddress(a.address))
  if (bad) return `"${bad.address}" isn't a valid email address.`
  if (draft.forwarded.reduce((sum, f) => sum + f.size, 0) > MAIL_MAX_ATTACHMENTS) return "Attachments can total 15 MB at most."
  if (!draft.subject.trim() && !draft.text.trim()) return "Add a subject or a message."
  return null
}

export function outgoing(draft: MailDraft): OutgoingMail {
  return { from: draft.from || undefined, to: draft.to, cc: draft.cc || undefined, subject: draft.subject, text: draft.text,
    reply: draft.reply && { ...draft.reply, include: draft.forwarded.length ? draft.forwarded.map(f => f.index) : undefined } }
}

/** An unchanged reply or blank form counts as empty, so leaving it doesn't ask. */
export const draftTouched = (draft: MailDraft, start: MailDraft) => draft.to !== start.to || draft.cc !== start.cc || draft.subject !== start.subject || draft.text !== start.text
