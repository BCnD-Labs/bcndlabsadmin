import assert from "node:assert/strict"
import { test } from "node:test"
import { createWorkspaceFileStore, type FsLike } from "../src/lib/workspace-file-store.ts"

function fakeFs(over: Partial<Record<keyof FsLike, unknown>> = {}) {
  const files = new Map<string, string>()
  const fs = {
    files,
    documentDirectory: "file:///data/app/documents/",
    readAsStringAsync: async (uri: string) => { const t = files.get(uri); if (t === undefined) throw new Error("ENOENT"); return t },
    writeAsStringAsync: async (uri: string, text: string) => { files.set(uri, text) },
    deleteAsync: async (uri: string) => { files.delete(uri) },
    moveAsync: async (o: { from: string; to: string }) => { files.set(o.to, files.get(o.from)!); files.delete(o.from) },
    ...over,
  }
  return fs as typeof fs & FsLike
}

test("write then read round-trips one JSON file in the document directory", async () => {
  const fs = fakeFs()
  const store = createWorkspaceFileStore(fs)
  assert.equal(await store.read(), null)
  await store.write('{"a":1}')
  await store.write('{"a":2}')
  assert.equal(await store.read(), '{"a":2}')
  assert.deepEqual([...fs.files.keys()], ["file:///data/app/documents/blackwall-workspace.json"], "no temp file is left behind")
})

test("a save cut short between the delete and the swap is recovered from the temporary file", async () => {
  const fs = fakeFs({ moveAsync: async () => { throw new Error("killed") } })
  const store = createWorkspaceFileStore(fs)
  await store.write("{\"safe\":true}")
  assert.equal(await store.read(), "{\"safe\":true}")
})

test("it never throws: native errors and a missing document directory degrade to no cache", async () => {
  const boom = async () => { throw new Error("disk full") }
  const broken = createWorkspaceFileStore(fakeFs({ readAsStringAsync: boom, writeAsStringAsync: boom, deleteAsync: boom, moveAsync: boom }))
  assert.equal(await broken.read(), null)
  await broken.write("x")
  const none = createWorkspaceFileStore(fakeFs({ documentDirectory: null }))
  assert.equal(await none.read(), null)
  await none.write("x")
})
