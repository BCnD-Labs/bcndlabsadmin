import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { cleanSvg, serviceIcon } from "../server/icons.ts"
import { FileConnectionStore } from "../server/store.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"

test("service logos: bad names are refused, fetched SVGs are cleaned and kept, then served without the network", async () => {
  const store = new FileConnectionStore(mkdtempSync(path.join(tmpdir(), "bw-icons-")))
  let calls = 0
  const fake = (async (url: string) => {
    calls++
    if (String(url).endsWith("/missing.svg")) return new Response("nope", { status: 404 })
    return new Response('<?xml version="1.0"?><svg onload="x()"><script>alert(1)</script><rect/></svg>', { status: 200 })
  }) as unknown as typeof fetch
  assert.deepEqual(await serviceIcon(store, "../etc/passwd", fake), { error: "Not a valid icon name", status: 400 })
  const first = await serviceIcon(store, "portainer", fake)
  assert.ok("svg" in first && first.svg.startsWith("<svg") && !first.svg.includes("script") && !first.svg.includes("onload"))
  const again = await serviceIcon(store, "portainer", fake)
  assert.deepEqual(again, first)
  assert.equal(calls, 1, "the second request is served from the store")
  const missing = await serviceIcon(store, "missing", fake)
  assert.equal("status" in missing && missing.status, 404)
  assert.equal(cleanSvg("not an svg"), undefined)
})

test("workspace snapshots from before the launcher still validate, with no services", () => {
  const old: Record<string, unknown> = { ...emptyWorkspace() }
  delete old.services
  assert.ok(validWorkspace(old))
  assert.deepEqual(old.services, [])
  const ts = "2026-11-02T00:00:00Z"
  const tile = { id: "s", name: "Portainer", url: "https://x:9443", description: "", group: "Infrastructure", pinned: false, createdAt: ts, updatedAt: ts }
  assert.ok(validWorkspace({ ...emptyWorkspace(), services: [tile] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), services: [{ ...tile, pinned: "yes" }] }))
})
