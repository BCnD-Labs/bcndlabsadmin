import { strict as assert } from "node:assert"
import { test } from "node:test"
import { bridgeSettings, mailAction, mailSend, mailTransports, newestUids, outgoing, parseMailMessage, previewText, saveMailAttachment } from "../server/providers/proton.ts"
import type { StoredConnection } from "../server/store.ts"

const connection: StoredConnection = {
  id: "test", provider: "proton", label: "Test", config: { username: "person@example.com" },
  secrets: { password: "bridge-generated-secret" }, status: "ok", createdAt: "2026-01-01", updatedAt: "2026-01-01",
}

test("Bridge settings stay on local loopback and reject invalid ports", () => {
  assert.deepEqual(bridgeSettings(connection), {
    host: "127.0.0.1", username: "person@example.com", password: "bridge-generated-secret", imapPort: 1143, smtpPort: 1025,
  })
  assert.throws(() => bridgeSettings({ ...connection, config: { ...connection.config, imapPort: "70000" } }), /port/)
})

test("a MIME message exposes decoded text and attachment bytes in stable index order", async () => {
  const source = Buffer.from([
    "From: Sender <sender@example.com>", "To: person@example.com", "Subject: Report", "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="test-boundary"', "", "--test-boundary",
    "Content-Type: text/plain; charset=utf-8", "", "Please review the attached report.", "--test-boundary",
    'Content-Type: text/plain; name="report.txt"', 'Content-Disposition: attachment; filename="report.txt"',
    "Content-Transfer-Encoding: base64", "", "cmVwb3J0IGJ5dGVz", "--test-boundary--", "",
  ].join("\r\n"))
  const parsed = await parseMailMessage({ seq: 1, uid: 42, size: source.length,
    envelope: { subject: "Report", from: [{ name: "Sender", address: "sender@example.com" }], to: [{ address: "person@example.com" }] },
    flags: new Set() }, source)
  assert.match(parsed.text, /Please review/)
  assert.equal(parsed.attachments[0].index, 0)
  assert.equal(parsed.attachments[0].name, "report.txt")
  assert.equal(parsed.attachmentData[0].toString(), "report bytes")
  assert.equal(parsed.unread, true)
})

test("the message list follows the received date, because Bridge numbers its newest mail first", () => {
  // As after a first sync: UID 1 is the newest synced message, older mail has higher numbers, and later arrivals are added at the end.
  const mailbox = [
    { uid: 1, internalDate: new Date("2026-03-03T00:00:00Z") },
    { uid: 2, internalDate: new Date("2026-02-02T00:00:00Z") },
    { uid: 3, internalDate: "2020-01-01T00:00:00Z" },
    { uid: 4, internalDate: new Date("2026-04-04T00:00:00Z") },
  ]
  assert.deepEqual(newestUids(mailbox, 3), [4, 1, 2])
  assert.deepEqual(newestUids([{ uid: 1 }, { uid: 2 }], 5), [2, 1])
})

test("sending validates the recipient before opening SMTP", async () => {
  await assert.rejects(mailSend(connection, { to: "bad-address", subject: "Hi", text: "Message" }), /recipient/)
})

test("saving a mail attachment writes to Nextcloud once and refuses to overwrite", async () => {
  const { createServer } = await import("node:http")
  let saved: Buffer | null = null
  let destination = ""
  const server = createServer(async (req, res) => {
    destination = req.url ?? ""
    assert.equal(req.headers["if-none-match"], "*")
    if (saved) { res.writeHead(412); res.end(); return }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    saved = Buffer.concat(chunks)
    res.writeHead(201); res.end()
  })
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const port = (server.address() as { port: number }).port
    const nextcloud: StoredConnection = { ...connection, provider: "nextcloud",
      config: { url: `http://127.0.0.1:${port}`, username: "person" }, secrets: { appPassword: "test" } }
    const path = await saveMailAttachment(nextcloud, "/Inbox", { name: "report.txt", mime: "text/plain" }, Buffer.from("first"))
    assert.equal(path, "/Inbox/report.txt")
    assert.match(destination, /\/remote.php\/dav\/files\/person\/Inbox\/report.txt$/)
    await assert.rejects(saveMailAttachment(nextcloud, "/Inbox", { name: "report.txt", mime: "text/plain" }, Buffer.from("second")), /already exists/i)
    assert.equal(saved?.toString(), "first")
  } finally { server.closeAllConnections(); server.close() }
})

test("mail API reports an unconnected Bridge without pretending mail is available", async () => {
  const { createServer } = await import("node:http")
  const { mkdtempSync, rmSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { createApi } = await import("../server/app.ts")
  const { FileConnectionStore } = await import("../server/store.ts")
  const { FileWorkspaceStore } = await import("../server/workspace.ts")
  const root = mkdtempSync(join(tmpdir(), "blackwall-mail-test-"))
  const server = createServer(createApi({ store: new FileConnectionStore(root), workspace: new FileWorkspaceStore(root) }))
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const port = (server.address() as { port: number }).port
    const response = await fetch(`http://127.0.0.1:${port}/api/mail/folders`, { headers: { "X-Blackwall": "1" } })
    assert.equal(response.status, 409)
    assert.match((await response.json()).error, /Connect and test Proton Mail Bridge/)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(root, { recursive: true, force: true })
  }
})

test("outgoing mail takes several recipients, only your own sender, and refuses bad input", () => {
  const mine = { ...connection, config: { username: "person@example.com", from: "me@domain.test" } }
  const made = outgoing(mine, { to: '"Lee, Jordan" <j@x.test>, sam@y.test', cc: "c@z.test", subject: "Hi", text: "" })
  assert.equal(made.from, "me@domain.test")
  assert.deepEqual(made.to, [{ name: "Lee, Jordan", address: "j@x.test" }, { name: "", address: "sam@y.test" }])
  assert.equal(outgoing(mine, { from: "person@example.com", to: "a@b.test", subject: "Hi", text: "x" }).from, "person@example.com")
  assert.throws(() => outgoing(mine, { from: "someone@else.test", to: "a@b.test", subject: "Hi", text: "x" }), /own addresses/)
  assert.throws(() => outgoing(mine, { to: "a@b.test, nope", subject: "Hi", text: "x" }), /recipient/)
  assert.throws(() => outgoing(mine, { to: "", subject: "Hi", text: "x" }), /recipient/)
  assert.throws(() => outgoing(mine, { to: "a@b.test", subject: "Hi\r\nBcc: x@y.test", text: "x" }), /subject/)
  assert.throws(() => outgoing(mine, { to: "a@b.test", subject: "Big", text: "", attachments: [{ name: "a.bin", mime: "x/y", data: Buffer.alloc(16 * 1024 * 1024).toString("base64") }] }), /15 MB/)
})

test("a preview line is the readable start of a message, even when only part of it was read", async () => {
  const source = Buffer.from("Subject: Hi\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><p>Hello <b>there</b>, see https://example.com/a/very/long/link now.</p><p>More")
  assert.equal(await previewText(source), "Hello there, see now. More")
  const withFile = Buffer.from('Subject: Hi\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n--b\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Café <b>notes</b></p>\r\n--b\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="a.pdf"\r\n\r\nx\r\n--b--\r\n')
  assert.equal(await previewText(withFile), "Café notes")
  assert.match((await parseMailMessage({ seq: 1, uid: 1, flags: new Set() }, withFile)).text, /Café notes/)
})

test("actions mark or move mail, never delete it, and refuse a folder that is not there", async () => {
  const calls: unknown[][] = []
  const original = mailTransports.imap
  const folder = (path: string, specialUse?: string) => ({ path, name: path, specialUse, flags: new Set<string>() })
  const record = (name: string) => async (...args: unknown[]) => { calls.push([name, ...args]); return true }
  mailTransports.imap = (() => ({ usable: true, connect: async () => {}, logout: async () => {}, mailboxOpen: async () => ({}),
    list: async () => [folder("INBOX"), folder("Archive", "\\Archive"), folder("Trash", "\\Trash"), folder("Labels/Work")],
    messageFlagsAdd: record("add"), messageFlagsRemove: record("remove"), messageMove: record("move"), messageCopy: record("copy"),
  })) as unknown as typeof original
  try {
    await mailAction(connection, "INBOX", [1, 2], "archive")
    await mailAction(connection, "INBOX", [3], "star")
    await mailAction(connection, "INBOX", [4], "unread")
    await mailAction(connection, "INBOX", [5], "label", "Labels/Work")
    assert.deepEqual(calls, [["move", "1,2", "Archive", { uid: true }], ["add", "3", ["\\Flagged"], { uid: true }], ["remove", "4", ["\\Seen"], { uid: true }], ["copy", "5", "Labels/Work", { uid: true }]])
    await assert.rejects(mailAction(connection, "INBOX", [1], "spam"), /nothing was moved/)
    await assert.rejects(mailAction(connection, "INBOX", [1], "move", "Folders/Gone"), /nothing was moved/)
    await assert.rejects(mailAction(connection, "Trash", [1], "trash"), /Already in/)
    await assert.rejects(mailAction(connection, "INBOX", [1], "label", "Archive"), /not a label/)
    assert.equal(calls.length, 4)
  } finally { mailTransports.imap = original }
})

test("mail requests share one Bridge login, run one at a time, and never retry a rejected password for a minute", async () => {
  const { bridgeError, resetBridgeSession, mailFolders } = await import("../server/providers/proton.ts")
  const original = mailTransports.imap
  resetBridgeSession()
  let logins = 0, running = 0, overlap = 0
  const good = () => { logins++; return { usable: true, connect: async () => {}, logout: async () => {}, close: () => {}, on: () => {},
    list: async () => { running++; overlap = Math.max(overlap, running); await new Promise((r) => setTimeout(r, 5)); running--; return [] } } }
  mailTransports.imap = good as unknown as typeof original
  try {
    await Promise.all([mailFolders(connection), mailFolders(connection), mailFolders(connection)])
    await mailFolders(connection)
    assert.equal(logins, 1); assert.equal(overlap, 1)
    resetBridgeSession()
    let attempts = 0
    mailTransports.imap = (() => ({ usable: false, on: () => {}, close: () => {}, connect: async () => { attempts++; throw Object.assign(new Error("Command failed"), { authenticationFailed: true }) } })) as unknown as typeof original
    const rejected = { ...connection, id: "rejected" }
    await assert.rejects(mailFolders(rejected), /Bridge rejected the saved sign-in/)
    await assert.rejects(mailFolders(rejected), /Bridge rejected the saved sign-in/)
    assert.equal(attempts, 1)
    // Saving the connection again (new updatedAt) or testing it tries Bridge afresh.
    await assert.rejects(mailFolders({ ...rejected, updatedAt: "2026-01-02" }), /rejected/)
    assert.equal(attempts, 2)
  } finally { mailTransports.imap = original; resetBridgeSession() }
  assert.equal((bridgeError(Object.assign(new Error("x"), { code: "ECONNREFUSED" })) as { status: number }).status, 503)
  assert.equal((bridgeError(Object.assign(new Error("x"), { code: "EAUTH" })) as { status: number }).status, 409)
})
