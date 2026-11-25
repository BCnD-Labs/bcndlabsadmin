import { ImapFlow, type FetchMessageObject, type ImapFlowOptions, type MessageStructureObject } from "imapflow"
import { simpleParser, type ParsedMail } from "mailparser"
import nodemailer from "nodemailer"
import { MAIL_MAX_ATTACHMENTS, MAIL_MAX_RECIPIENTS, MAIL_PAGE_SIZE, folderRole, splitAddresses, validAddress, type MailActionName, type MailFolder, type MailSummary, type OutgoingMail } from "../../shared/mail.ts"
import type { StoredConnection } from "../store.ts"
import { ProviderError, need } from "../http.ts"
import { cleanPath, dav } from "./nextcloud.ts"
import type { TestResult } from "./index.ts"

const MAX_MESSAGE = 20 * 1024 * 1024
/** How much of each listed message is read to make its preview line. */
const PREVIEW_BYTES = 32 * 1024

/** The mail libraries, replaceable in tests so no test needs a running Bridge. */
export const mailTransports = {
  imap: (options: ImapFlowOptions) => new ImapFlow(options),
  smtp: (options: Parameters<typeof nodemailer.createTransport>[0]) => nodemailer.createTransport(options),
}
const address = (items?: { name?: string; address?: string }[]) =>
  (items ?? []).map((item) => item.name ? `${item.name} <${item.address ?? ""}>` : item.address ?? "").join(", ")

export function bridgeSettings(c: StoredConnection) {
  const port = (value: string | undefined, fallback: number) => {
    const n = Number(value || fallback)
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw new ProviderError("Bridge port must be between 1 and 65535", 400)
    return n
  }
  return {
    host: "127.0.0.1",
    username: need(c.config.username, "Bridge username"),
    password: need(c.secrets.password, "Bridge password"),
    imapPort: port(c.config.imapPort, 1143),
    smtpPort: port(c.config.smtpPort, 1025),
  }
}

async function withImap<T>(c: StoredConnection, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const s = bridgeSettings(c)
  const client = mailTransports.imap({ host: s.host, port: s.imapPort, secure: false, doSTARTTLS: true,
    tls: { rejectUnauthorized: false }, auth: { user: s.username, pass: s.password },
    logger: false, connectionTimeout: 10_000, socketTimeout: 30_000, disableAutoIdle: true })
  try {
    await client.connect()
    return await fn(client)
  } finally {
    if (client.usable) await client.logout().catch(() => {})
    else client.close()
  }
}

const summary = (m: FetchMessageObject): MailSummary => ({
  uid: m.uid, subject: m.envelope?.subject || "(no subject)", from: address(m.envelope?.from),
  to: address(m.envelope?.to), date: new Date(m.envelope?.date ?? m.internalDate ?? 0).toISOString(),
  unread: !m.flags?.has("\\Seen"), starred: !!m.flags?.has("\\Flagged"), answered: !!m.flags?.has("\\Answered"), size: m.size ?? 0,
})

/** A message's reply chain, for the In-Reply-To and References headers. */
const chain = (parsed: ParsedMail) => [...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : []), ...(parsed.messageId ? [parsed.messageId] : [])]

/** A message's words. The parser leaves them out when HTML sits beside attachments, so the HTML is then read on its own. */
async function wordsOf(parsed: ParsedMail) {
  if (parsed.text?.trim() || !parsed.html) return parsed.text ?? ""
  return (await simpleParser(Buffer.from(`Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${parsed.html}`))).text ?? ""
}

export async function parseMailMessage(meta: FetchMessageObject, source: Buffer) {
  const parsed = await simpleParser(source)
  const html = typeof parsed.html === "string" ? parsed.html : ""
  return { ...summary(meta), cc: address(meta.envelope?.cc), replyTo: address(meta.envelope?.replyTo), text: await wordsOf(parsed), html,
    attachments: parsed.attachments.map((a, index) => ({ index, name: a.filename || `attachment-${index + 1}`, mime: a.contentType, size: a.size, inline: !!a.related })),
    attachmentData: parsed.attachments.map((a) => a.content), messageId: parsed.messageId ?? "", references: chain(parsed) }
}

/** The first readable words of a message, from the start of its source. */
export async function previewText(source: Buffer) {
  try {
    const parsed = await simpleParser(source, { skipImageLinks: true, skipTextToHtml: true, skipTextLinks: true })
    return (await wordsOf(parsed)).replace(/https?:\/\/\S+|\[[^\]\n]*\]/g, " ").replace(/[\s͏​-‏⁠﻿]+/g, " ").trim().slice(0, 180)
  } catch { return "" }
}

const hasFiles = (part?: MessageStructureObject): boolean => !!part && (part.disposition?.toLowerCase() === "attachment" || !!part.childNodes?.some(hasFiles))

export async function mailFolders(c: StoredConnection): Promise<MailFolder[]> {
  return withImap(c, async (client) => (await client.list({ statusQuery: { messages: true, unseen: true } })).filter((f) => !f.flags.has("\\Noselect"))
    .map((f) => ({ path: f.path, name: f.name, specialUse: f.specialUse ?? null, total: f.status?.messages, unread: f.status?.unseen })))
}

/** The addresses mail can be sent from: the connection's "Send from" first, then the Bridge sign-in. */
export const mailAddresses = (c: StoredConnection) => [...new Set([c.config.from, c.config.username].filter((a): a is string => !!a && validAddress(a)))]

/** The most recently received messages, newest first. Bridge syncs the newest mail first, so a higher UID does not mean newer. */
export function newestUids(messages: { uid: number; internalDate?: Date | string }[], limit: number, skip = 0) {
  const at = (m: { internalDate?: Date | string }) => new Date(m.internalDate ?? 0).getTime() || 0
  return [...messages].sort((a, b) => at(b) - at(a) || b.uid - a.uid).slice(skip, skip + limit).map((m) => m.uid)
}

export async function mailList(c: StoredConnection, folder: string, { query = "", page = 0 }: { query?: string; page?: number } = {}) {
  return withImap(c, async (client) => {
    const empty = { messages: [] as MailSummary[], total: 0, page, pageSize: MAIL_PAGE_SIZE }
    const mailbox = await client.mailboxOpen(folder, { readOnly: true })
    if (!mailbox.exists) return empty
    let matches: Set<number> | null = null
    if (query) {
      const found = await client.search({ or: [{ subject: query }, { from: query }, { to: query }, { cc: query }, { body: query }] }, { uid: true })
      if (found === false) throw new ProviderError("Search didn't finish. Try again.", 502)
      matches = new Set(found)
    }
    const dates = []
    for await (const m of client.fetch("1:*", { uid: true, internalDate: true })) if (!matches || matches.has(m.uid)) dates.push({ uid: m.uid, internalDate: m.internalDate })
    const uids = newestUids(dates, MAIL_PAGE_SIZE, page * MAIL_PAGE_SIZE)
    if (!uids.length) return { ...empty, total: dates.length }
    const found: { summary: MailSummary; source?: Buffer }[] = []
    for await (const m of client.fetch(uids.join(","), { uid: true, flags: true, envelope: true, internalDate: true, size: true, bodyStructure: true, source: { start: 0, maxLength: PREVIEW_BYTES } }, { uid: true })) {
      found.push({ summary: { ...summary(m), hasAttachments: hasFiles(m.bodyStructure) }, source: m.source })
    }
    const messages = await Promise.all(found.map(async (m) => ({ ...m.summary, snippet: m.source ? await previewText(m.source) : "" })))
    return { ...empty, total: dates.length, messages: messages.sort((a, b) => uids.indexOf(a.uid) - uids.indexOf(b.uid)) }
  })
}

export async function mailRead(c: StoredConnection, folder: string, uid: number) {
  return withImap(c, async (client) => {
    await client.mailboxOpen(folder, { readOnly: true })
    const meta = await client.fetchOne(String(uid), { size: true, envelope: true, flags: true, internalDate: true }, { uid: true })
    if (!meta) throw new ProviderError("Message no longer exists", 404)
    if ((meta.size ?? 0) > MAX_MESSAGE) throw new ProviderError("Message is too large to open in Blackwall (20 MB limit)", 413)
    const raw = await client.fetchOne(String(uid), { source: true }, { uid: true })
    const source = raw && raw.source
    if (!source) throw new ProviderError("Message content unavailable", 502)
    if (source.length > MAX_MESSAGE) throw new ProviderError("Message is too large to open in Blackwall (20 MB limit)", 413)
    return parseMailMessage(meta, source)
  })
}

const ROLE_FOR = { archive: "\\Archive", spam: "\\Junk", trash: "\\Trash" } as const

/** Marks or moves messages. Nothing here deletes mail. */
export async function mailAction(c: StoredConnection, folder: string, uids: number[], action: MailActionName, target?: string) {
  return withImap(c, async (client) => {
    const range = uids.join(",")
    let destination = ""
    if (action === "archive" || action === "spam" || action === "trash" || action === "inbox" || action === "move" || action === "label") {
      const folders = await client.list()
      const found = action === "inbox" ? folders.find((f) => f.path.toUpperCase() === "INBOX")
        : action === "move" || action === "label" ? folders.find((f) => f.path === target && !f.flags.has("\\Noselect"))
        : folders.find((f) => folderRole({ path: f.path, name: f.name, specialUse: f.specialUse ?? null }) === ROLE_FOR[action])
      if (!found) throw new ProviderError(action === "move" || action === "label" ? "That folder no longer exists; nothing was moved" : `Proton's ${action} folder was not found; nothing was moved`, 409)
      if (action === "label" && !found.path.startsWith("Labels/")) throw new ProviderError("That is not a label", 400)
      if (found.path === folder) throw new ProviderError(`Already in ${found.name}`, 409)
      destination = found.path
    }
    await client.mailboxOpen(folder)
    const options = { uid: true }
    let done: unknown
    if (action === "read") done = await client.messageFlagsAdd(range, ["\\Seen"], options)
    else if (action === "unread") done = await client.messageFlagsRemove(range, ["\\Seen"], options)
    else if (action === "star") done = await client.messageFlagsAdd(range, ["\\Flagged"], options)
    else if (action === "unstar") done = await client.messageFlagsRemove(range, ["\\Flagged"], options)
    // A label is a second place for the same message, so it is copied there and stays where it was.
    else if (action === "label") done = await client.messageCopy(range, destination, options)
    else done = await client.messageMove(range, destination, options)
    if (!done) throw new ProviderError("Proton didn't make that change. Refresh and try again.", 502)
    return { done: true, destination: destination || undefined }
  })
}

export const mailTrash = (c: StoredConnection, folder: string, uid: number) => mailAction(c, folder, [uid], "trash")

function recipients(list: string | undefined) {
  const found = splitAddresses(list ?? "")
  if (found.some((a) => !validAddress(a.address) || /[\r\n]/.test(a.name))) throw new ProviderError("Check the recipient addresses: one of them isn't a valid email address", 400)
  return found
}

/** Checks an outgoing message before any server is contacted. */
export function outgoing(c: StoredConnection, input: OutgoingMail) {
  const s = bridgeSettings(c)
  const to = recipients(input.to), cc = recipients(input.cc), bcc = recipients(input.bcc)
  const count = to.length + cc.length + bcc.length
  if (!count) throw new ProviderError("Add at least one recipient", 400)
  if (count > MAIL_MAX_RECIPIENTS) throw new ProviderError(`A message can go to ${MAIL_MAX_RECIPIENTS} recipients at most`, 400)
  if (/[\r\n]/.test(input.subject) || input.subject.length > 300 || input.text.length > 200_000 || !(input.subject.trim() || input.text.trim())) throw new ProviderError("Add a subject (up to 300 characters) or a message", 400)
  const allowed = mailAddresses(c)
  const from = input.from || c.config.from || s.username
  if (!validAddress(from)) throw new ProviderError("Send from must be one valid email address", 400)
  if (input.from && !allowed.includes(input.from)) throw new ProviderError("Choose one of your own addresses to send from", 400)
  let bytes = 0
  const attachments = (input.attachments ?? []).map((a) => {
    const content = Buffer.from(String(a.data), "base64")
    bytes += content.length
    return { filename: String(a.name).replace(/[\u0000-\u001f]/g, "_").slice(0, 200) || "attachment", contentType: /^[\w.+-]+\/[\w.+-]+$/.test(a.mime) ? a.mime : "application/octet-stream", content }
  })
  if (bytes > MAIL_MAX_ATTACHMENTS) throw new ProviderError("Attachments can total 15 MB at most", 413)
  return { from, to, cc, bcc, subject: input.subject, text: input.text, attachments }
}

export async function mailSend(c: StoredConnection, input: OutgoingMail) {
  const s = bridgeSettings(c)
  const message: ReturnType<typeof outgoing> & { inReplyTo?: string; references?: string[] } = outgoing(c, input)
  const reply = input.reply
  if (reply) {
    const original = await mailRead(c, reply.folder, reply.uid)
    if (reply.mode !== "forward" && original.messageId) Object.assign(message, { inReplyTo: original.messageId, references: original.references })
    for (const index of reply.include ?? []) {
      const meta = original.attachments[index], content = original.attachmentData[index]
      if (!meta || !content) throw new ProviderError("An attachment from the original message is no longer there; nothing was sent", 409)
      message.attachments.push({ filename: meta.name, contentType: meta.mime, content: Buffer.from(content) })
    }
    if (message.attachments.reduce((sum, a) => sum + a.content.length, 0) > MAIL_MAX_ATTACHMENTS) throw new ProviderError("Attachments can total 15 MB at most", 413)
  }
  const transport = mailTransports.smtp({ host: s.host, port: s.smtpPort, secure: false, requireTLS: true,
    tls: { rejectUnauthorized: false }, auth: { user: s.username, pass: s.password },
    connectionTimeout: 10_000, greetingTimeout: 10_000 })
  try {
    const sent = await transport.sendMail(message)
    return { sent: true, id: sent.messageId as string }
  } finally { transport.close() }
}

export async function testProton(c: StoredConnection): Promise<TestResult> {
  const s = bridgeSettings(c)
  const folders = await mailFolders(c)
  const transport = nodemailer.createTransport({ host: s.host, port: s.smtpPort, secure: false, requireTLS: true,
    tls: { rejectUnauthorized: false }, auth: { user: s.username, pass: s.password }, connectionTimeout: 10_000 })
  try { await transport.verify() } finally { transport.close() }
  return { status: "ok", account: s.username, summary: [{ label: "Mail folders", value: String(folders.length) }, { label: "Send", value: "Ready" }] }
}

/** Save received bytes under their attachment name, never replacing an existing file. */
export async function saveMailAttachment(nextcloud: StoredConnection, folder: string, attachment: { name: string; mime: string }, data: Buffer) {
  const candidate = attachment.name.replace(/[/\\\u0000-\u001f]/g, "_").trim().slice(0, 200)
  const safeName = candidate && candidate !== "." && candidate !== ".." ? candidate : "attachment"
  const path = cleanPath(`${folder}/${safeName}`)
  try {
    await dav(nextcloud, "PUT", path, { headers: { "If-None-Match": "*", "Content-Type": attachment.mime || "application/octet-stream" },
      body: new Uint8Array(data) as unknown as RequestInit["body"], timeout: 60_000 })
  } catch (error) {
    if (error instanceof ProviderError && error.status === 409) throw new ProviderError("That filename already exists in Nextcloud. Choose another folder.", 409)
    throw error
  }
  return path
}
