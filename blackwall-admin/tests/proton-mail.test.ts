import { strict as assert } from "node:assert"
import { test } from "node:test"
import { bridgeSettings, mailSend, newestUids, parseMailMessage, saveMailAttachment } from "../server/providers/proton.ts"
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
