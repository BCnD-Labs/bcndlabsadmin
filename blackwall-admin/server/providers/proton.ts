import { ImapFlow, type FetchMessageObject } from "imapflow"
import { simpleParser } from "mailparser"
import nodemailer from "nodemailer"
import type { StoredConnection } from "../store.ts"
import { ProviderError, need } from "../http.ts"
import { cleanPath, dav } from "./nextcloud.ts"
import type { TestResult } from "./index.ts"

const MAX_MESSAGE = 20 * 1024 * 1024
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
  const client = new ImapFlow({ host: s.host, port: s.imapPort, secure: false, doSTARTTLS: true,
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

const summary = (m: FetchMessageObject) => ({
  uid: m.uid, subject: m.envelope?.subject || "(no subject)", from: address(m.envelope?.from),
  to: address(m.envelope?.to), date: new Date(m.envelope?.date ?? m.internalDate ?? 0).toISOString(),
  unread: !m.flags?.has("\\Seen"), size: m.size ?? 0,
})

export async function parseMailMessage(meta: FetchMessageObject, source: Buffer) {
  const parsed = await simpleParser(source)
  return { ...summary(meta), text: parsed.text ?? "", html: typeof parsed.html === "string" ? parsed.html : "",
    attachments: parsed.attachments.map((a, index) => ({ index, name: a.filename || `attachment-${index + 1}`, mime: a.contentType, size: a.size })),
    attachmentData: parsed.attachments.map((a) => a.content) }
}

export async function mailFolders(c: StoredConnection) {
  return withImap(c, async (client) => (await client.list()).filter((f) => !f.flags.has("\\Noselect"))
    .map((f) => ({ path: f.path, name: f.name, specialUse: f.specialUse ?? null })))
}

export async function mailList(c: StoredConnection, folder: string) {
  return withImap(c, async (client) => {
    await client.mailboxOpen(folder, { readOnly: true })
    const found = await client.search({ all: true }, { uid: true })
    const uids = Array.isArray(found) ? found.sort((a, b) => a - b).slice(-100).reverse() : []
    if (!uids.length) return []
    const messages = []
    for await (const m of client.fetch(uids.join(","), { uid: true, flags: true, envelope: true, internalDate: true, size: true }, { uid: true })) messages.push(summary(m))
    return messages.sort((a, b) => b.uid - a.uid)
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

export async function mailTrash(c: StoredConnection, folder: string, uid: number) {
  return withImap(c, async (client) => {
    const trash = (await client.list()).find((f) => f.specialUse === "\\Trash")?.path
    if (!trash) throw new ProviderError("Proton's Trash folder was not found; nothing was deleted", 409)
    if (trash === folder) throw new ProviderError("Message is already in Trash", 409)
    await client.mailboxOpen(folder)
    const existing = await client.fetchOne(String(uid), { uid: true }, { uid: true })
    if (!existing) throw new ProviderError("Message no longer exists", 404)
    const moved = await client.messageMove(String(uid), trash, { uid: true })
    if (!moved) throw new ProviderError("Could not move message to Trash", 502)
    return { moved: true, trash }
  })
}

export async function mailSend(c: StoredConnection, input: { to: string; subject: string; text: string }) {
  const s = bridgeSettings(c)
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(input.to) || input.to.length > 254) throw new ProviderError("Enter one valid recipient address", 400)
  if (!input.subject.trim() || input.subject.length > 300 || !input.text.trim() || input.text.length > 100_000) throw new ProviderError("Add a subject and message", 400)
  const transport = nodemailer.createTransport({ host: s.host, port: s.smtpPort, secure: false, requireTLS: true,
    tls: { rejectUnauthorized: false }, auth: { user: s.username, pass: s.password },
    connectionTimeout: 10_000, greetingTimeout: 10_000 })
  try {
    const from = c.config.from || s.username
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(from)) throw new ProviderError("Send from must be one valid email address", 400)
    const sent = await transport.sendMail({ from, to: input.to, subject: input.subject, text: input.text })
    return { sent: true, id: sent.messageId }
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
