import assert from "node:assert/strict"
import { test } from "node:test"
import { formatSize } from "../src/lib/shared.ts"
import { crumbs, fetchFolder, fetchStorageInfo, fetchText, fileAction, nextcloudLink, quotaLine, storageUrl, viewText, VIEW_LIMIT } from "../src/lib/storage-client.ts"

const A = "https://blackwall.example.ts.net/"
const reply = (status: number, body: unknown) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const file = (name: string, extra: Record<string, unknown> = {}) => ({ name, path: `/Docs/${name}`, type: "file", size: 120, modified: "2026-11-10T10:00:00.000Z", ...extra })

test("requests go to the server's storage routes with the Blackwall header and cookie", async () => {
  assert.equal(storageUrl(A, "list", "/My Docs"), "https://blackwall.example.ts.net/api/storage/list?path=%2FMy%20Docs")
  let seen: { url: string; init?: RequestInit } | undefined
  await fetchFolder(A, "/", async (url, init) => { seen = { url: String(url), init }; return new Response(JSON.stringify({ path: "/", entries: [] })) })
  assert.equal(seen?.url, "https://blackwall.example.ts.net/api/storage/list?path=%2F")
  assert.equal(seen?.init?.credentials, "include")
  assert.equal((seen?.init?.headers as Record<string, string>)["X-Blackwall"], "1")
})

test("a folder listing is checked and keeps only what the app uses", async () => {
  const r = await fetchFolder(A, "/Docs", reply(200, { path: "/Docs", entries: [{ name: "Sub", path: "/Docs/Sub", type: "dir", size: 0, modified: "x" }, file("a.md", { fileId: "42", etag: "e" })], quota: { used: 5, free: 10 } }))
  assert.ok(r.ok)
  assert.equal(r.value.entries.length, 2)
  assert.equal(r.value.entries[1].fileId, "42")
  assert.deepEqual(r.value.quota, { used: 5, free: 10 })
  const bad = await fetchFolder(A, "/", reply(200, { path: "/", entries: [{ name: 1 }] }))
  assert.deepEqual(bad, { ok: false, kind: "error", message: "The server's answer wasn't in a form the app understands." })
})

test("failures are fixed short messages; nothing from the server body is shown", async () => {
  const notConnected = await fetchFolder(A, "/", reply(409, { error: "secret detail https://cloud.example" }))
  assert.equal(notConnected.ok, false)
  assert.ok(!notConnected.ok && notConnected.kind === "not-connected" && !notConnected.message.includes("secret"))
  const out = await fetchStorageInfo(A, reply(401, {}))
  assert.ok(!out.ok && out.kind === "signed-out")
  const big = await fetchText(A, "/big.log", reply(413, { error: "x" }))
  assert.ok(!big.ok && big.message.includes("over 2 MB"))
  const down = await fetchFolder(A, "/", async () => { throw new Error("ECONNREFUSED 10.0.0.2") })
  assert.ok(!down.ok && down.message.startsWith("Couldn't reach the server") && !down.message.includes("10.0.0.2"))
  const odd = await fetchFolder(A, "/", reply(502, "nope"))
  assert.ok(!odd.ok && odd.message === "The server answered 502.")
})

test("storage info says plainly whether Nextcloud is connected", async () => {
  const off = await fetchStorageInfo(A, reply(200, { connected: false }))
  assert.ok(off.ok && off.value.connected === false)
  const on = await fetchStorageInfo(A, reply(200, { connected: true, status: "ok", url: "https://cloud.example.ts.net", user: "me" }))
  assert.ok(on.ok && on.value.url === "https://cloud.example.ts.net")
})

test("opening: folders browse, small text files view, others open in Nextcloud when there is a link", () => {
  const info = { connected: true, url: "https://cloud.example.ts.net/" }
  assert.equal(fileAction({ ...file("x"), type: "dir" } as never, info), "folder")
  assert.equal(fileAction(file("notes.md") as never, info), "text")
  assert.equal(fileAction(file("huge.log", { size: 3 * 1024 * 1024, fileId: "9" }) as never, info), "nextcloud")
  assert.equal(fileAction(file("report.docx", { fileId: "7" }) as never, info), "nextcloud")
  assert.equal(fileAction(file("report.docx") as never, info), "none")
  assert.equal(fileAction(file("report.docx", { fileId: "7" }) as never, null), "none")
  assert.equal(nextcloudLink(info, file("r.docx", { fileId: "7" }) as never), "https://cloud.example.ts.net/f/7")
  assert.equal(nextcloudLink({ connected: true, url: "javascript:alert(1)" }, file("r.docx", { fileId: "7" }) as never), null)
})

test("crumbs, quota and the text viewer cut", () => {
  assert.deepEqual(crumbs("/"), [{ label: "Files", path: "/" }])
  assert.deepEqual(crumbs("/Docs/Work"), [{ label: "Files", path: "/" }, { label: "Docs", path: "/Docs" }, { label: "Work", path: "/Docs/Work" }])
  assert.equal(quotaLine(undefined, formatSize), null)
  assert.equal(quotaLine({ used: 2048, free: 2048 }, formatSize), "Used 2.0 KB of 4.0 KB")
  assert.equal(quotaLine({ used: 2048, free: -3 }, formatSize), "Used 2.0 KB")
  assert.deepEqual(viewText("short"), { text: "short", cut: false })
  const long = viewText("y".repeat(VIEW_LIMIT + 5))
  assert.equal(long.cut, true)
  assert.equal(long.text.length, VIEW_LIMIT)
})
