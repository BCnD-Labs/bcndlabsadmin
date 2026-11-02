import assert from "node:assert/strict"
import { test } from "node:test"
import { checkServices, validStatusUrls } from "../server/service-status.ts"

test("service status: any HTTP answer is up, 5xx and connection failures are down", async () => {
  const fake = (async (url: string) => {
    if (url.includes("refused")) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })
    const status = url.includes("auth") ? 401 : url.includes("broken") ? 502 : 200
    return new Response("", { status })
  }) as typeof fetch
  const results = await checkServices(["https://a.test", "https://auth.test", "https://broken.test", "https://refused.test"], fake)
  assert.deepEqual(results.map((r) => r.up), [true, true, false, false])
  assert.equal(results[3].error, "ECONNREFUSED")
  assert.ok(typeof results[0].ms === "number")
})

test("service status: only http(s) lists of a sane size are accepted", () => {
  assert.deepEqual(validStatusUrls(["https://x.test", "https://x.test"]), ["https://x.test"])
  assert.equal(validStatusUrls(["file:///etc/passwd"]), undefined)
  assert.equal(validStatusUrls("https://x.test"), undefined)
  assert.equal(validStatusUrls(Array.from({ length: 61 }, (_, i) => `https://h${i}.test`)), undefined)
})
