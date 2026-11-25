import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { serveStatic } from "../server/static.ts"

test("the app's security policy lets it show its own object-URL pictures but loads scripts only from itself", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bw-static-"))
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>x</title>")
  const server = createServer(serveStatic(dir))
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/`)
    const csp = res.headers.get("content-security-policy") ?? ""
    const directive = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? ""
    assert.match(directive("img-src"), /\bblob:/, "library pictures are shown from blob: addresses")
    assert.ok(!directive("img-src").includes("http"), "no outside image hosts")
    assert.match(directive("frame-src"), /\bblob:/, "attachment PDF previews use local object URLs")
    assert.ok(!directive("frame-src").includes("http"), "frames cannot load outside sites")
    assert.equal(directive("script-src"), "", "scripts fall back to default-src 'self'")
    assert.match(directive("default-src"), /^default-src 'self'$/)
    assert.ok(!/unsafe-eval|unsafe-inline/.test(directive("default-src")) && !csp.includes("jsdelivr"))
  } finally {
    server.closeAllConnections(); server.close(); rmSync(dir, { recursive: true, force: true })
  }
})
