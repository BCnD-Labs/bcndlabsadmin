import assert from "node:assert/strict"
import { test } from "node:test"
import { fetchMailFolders, fetchMailPage, mailUrl, parseFolders, parseMessage, parsePage } from "../src/lib/mail-client.ts"

const summary = { uid: 12, subject: "Hello", from: "Pat <pat@example.com>", to: "me@example.com", date: "2026-11-25T05:00:00Z", unread: true, starred: false, answered: false, size: 123 }

test("mail URLs encode folder names and search without changing the server origin", () => {
  assert.equal(mailUrl("https://blackwall.example.ts.net/", "messages", "My labels/Work & school", { page: 2, q: "a+b" }),
    "https://blackwall.example.ts.net/api/mail/messages?folder=My%20labels%2FWork%20%26%20school&page=2&q=a%2Bb")
})

test("folders, pages, and messages reject broken server shapes", () => {
  assert.equal(parseFolders({ folders: [{ path: "INBOX", name: "Inbox", specialUse: "\\Inbox", unread: 0 }], addresses: ["me@example.com"] })?.folders[0].unread, 0)
  assert.equal(parseFolders({ folders: [{ path: 7, name: "Inbox", specialUse: null }], addresses: [] }), null)
  assert.equal(parsePage({ messages: [summary], total: 1, page: 0, pageSize: 50 })?.messages[0].subject, "Hello")
  assert.equal(parsePage({ messages: [{ ...summary, uid: "12" }], total: 1, page: 0, pageSize: 50 }), null)
  assert.equal(parseMessage({ ...summary, cc: "", replyTo: "", text: "Body", html: "", attachments: [{ index: 0, name: "note.txt", mime: "text/plain", size: 4 }] })?.attachments[0].name, "note.txt")
  assert.equal(parseMessage({ ...summary, cc: "", replyTo: "", text: "Body", html: "", attachments: [{ index: -1, name: "bad", mime: "text/plain", size: 1 }] }), null)
})

test("mail requests use the Blackwall session and report connection state without echoing the body", async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fake = (status: number): typeof fetch => async (url, init) => { calls.push({ url: String(url), init: init ?? {} }); return new Response(JSON.stringify({ error: "secret server detail" }), { status }) }
  const signedOut = await fetchMailFolders("https://blackwall.example.ts.net", fake(401))
  assert.deepEqual(signedOut.ok ? null : signedOut.kind, "signed-out")
  assert.equal(calls[0].init.credentials, "include")
  assert.equal((calls[0].init.headers as Record<string, string>)["X-Blackwall"], "1")
  const disconnected = await fetchMailPage("https://blackwall.example.ts.net", "INBOX", 0, "", fake(409))
  assert.deepEqual(disconnected.ok ? null : disconnected.kind, "not-connected")
  assert.ok(!JSON.stringify(disconnected).includes("secret server detail"))
})
