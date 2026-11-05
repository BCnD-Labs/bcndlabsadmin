import assert from "node:assert/strict"
import { test } from "node:test"
import { checkOne, checkServices, explainFailure, validStatusUrls } from "../server/service-status.ts"

test("service status: any HTTP answer is up, 5xx and connection failures are down", async () => {
  const fake = (async (url: string) => {
    if (url.includes("refused")) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })
    const status = url.includes("auth") ? 401 : url.includes("broken") ? 502 : 200
    return new Response("", { status })
  }) as typeof fetch
  const results = await checkServices(["https://a.test", "https://auth.test", "https://broken.test", "https://refused.test"], fake)
  assert.deepEqual(results.map((r) => r.up), [true, true, false, false])
  assert.equal(results[3].error, "ECONNREFUSED")
  assert.match(results[3].reason ?? "", /nothing is listening/)
  assert.match(results[2].reason ?? "", /HTTP 502/)
  assert.equal(results[0].reason, undefined, "an up service has no reason")
  assert.ok(typeof results[0].ms === "number")
})

test("service status: only http(s) lists of a sane size are accepted", () => {
  assert.deepEqual(validStatusUrls(["https://x.test", "https://x.test"]), ["https://x.test"])
  assert.equal(validStatusUrls(["file:///etc/passwd"]), undefined)
  assert.equal(validStatusUrls("https://x.test"), undefined)
  assert.equal(validStatusUrls(Array.from({ length: 61 }, (_, i) => `https://h${i}.test`)), undefined)
})

test("service status: an expired certificate is named as such, and unknown failures keep their code", async () => {
  const expired = (async () => {
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "CERT_HAS_EXPIRED" } })
  }) as typeof fetch
  const r = await checkOne("https://old-cert.test", expired)
  assert.deepEqual([r.up, r.error, r.reason], [false, "CERT_HAS_EXPIRED", "Certificate expired"])
  assert.equal(explainFailure("SOMETHING_NEW"), "SOMETHING_NEW")
  const timeout = (async () => {
    throw Object.assign(new Error("aborted"), { name: "TimeoutError" })
  }) as typeof fetch
  assert.equal((await checkOne("https://slow.test", timeout)).reason, "No answer within 5 seconds")
})
