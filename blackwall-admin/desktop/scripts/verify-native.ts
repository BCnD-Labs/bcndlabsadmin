/** Smoke test for the bundled Mac workspace and its authenticated API bridge.
 * Run after desktop:compile: npx electron desktop/scripts/verify-native.ts
 */
import { app } from "electron"
import { createServer } from "node:http"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { emptyWorkspace } from "../../shared/workspace.ts"
import { startShell } from "../out/main/app.js"

const userData = mkdtempSync(path.join(tmpdir(), "blackwall-native-check-"))
let requests = 0
const server = createServer((req, res) => {
  requests++
  if (req.headers["x-blackwall"] !== "1") return void res.writeHead(403).end()
  res.setHeader("Content-Type", "application/json")
  if (req.url === "/api/login" && req.method === "POST") {
    res.setHeader("Set-Cookie", "blackwall-check=ok; HttpOnly; SameSite=Lax; Path=/")
    return void res.end("{}")
  }
  if (req.url === "/api/session") return void res.end(JSON.stringify({ authRequired: true, authenticated: req.headers.cookie?.includes("blackwall-check=ok") ?? false }))
  if (req.url === "/api/workspace") return void res.end(JSON.stringify({ id: "mac-smoke", revision: 1, data: emptyWorkspace() }))
  if (req.url === "/api/connections") return void res.end("[]")
  res.writeHead(404).end(JSON.stringify({ error: "Unavailable in test" }))
})

function assert(ok: boolean, message: string) {
  if (!ok) throw new Error(message)
  console.log(`PASS ${message}`)
}

server.listen(0, "127.0.0.1", () => {
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No test port")
  const controller = startShell({ userDataDir: userData })
  if (!controller) throw new Error("Could not start the Mac app")
  controller.config.update({ webAddress: `http://127.0.0.1:${address.port}/` })

  void (async () => {
    await controller.ready
    await controller.chromeReady()
    const wc = controller.tabs()?.pinned?.view?.webContents
    assert(!!wc, "Bundled workspace view exists")
    await new Promise<void>((resolve, reject) => {
      if (!wc!.isLoading()) return resolve()
      wc!.once("did-finish-load", () => resolve())
      wc!.once("did-fail-load", (_e, _code, description) => reject(new Error(description)))
    })
    assert(wc!.getURL().startsWith("bw-native://app/"), "Workspace loads from the app bundle")
    let runtime = ""
    for (let i = 0; i < 40; i++) {
      runtime = await wc!.executeJavaScript("document.documentElement.dataset.runtime || ''")
      if (runtime) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert(runtime === "mac-native", "Mac desktop treatment is active")
    const result = await wc!.executeJavaScript(`(async () => {
      const before = await fetch('/api/session', { headers: { 'X-Blackwall': '1' } }).then(r => r.json());
      await fetch('/api/login', { method: 'POST', headers: { 'X-Blackwall': '1', 'Content-Type': 'application/json' }, body: '{}' });
      const after = await fetch('/api/session', { headers: { 'X-Blackwall': '1' } }).then(r => r.json());
      return { before, after };
    })()`)
    assert(result.before.authenticated === false && result.after.authenticated === true, "API bridge preserves sign-in cookies")
    assert(requests >= 3, "API requests reach the configured server")
    await wc!.executeJavaScript("location.href = '/productivity'")
    for (let i = 0; i < 40; i++) {
      if (await wc!.executeJavaScript("!!document.querySelector('[data-testid=planner]')").catch(() => false)) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert(wc!.getURL() === "bw-native://app/productivity", "Workspace route survives a reload")
    assert(await wc!.executeJavaScript("!!document.querySelector('[data-testid=planner]')"), "Planner opens with server workspace data")
    await wc!.executeJavaScript(`location.href = ${JSON.stringify(`http://127.0.0.1:${address.port}/productivity`)}`)
    await new Promise((resolve) => setTimeout(resolve, 150))
    assert(wc!.getURL() === "bw-native://app/productivity", "Links back to the server stay in the Mac workspace")
    if (process.env.BW_NATIVE_SHOT) writeFileSync(process.env.BW_NATIVE_SHOT, (await wc!.capturePage()).toPNG())
    if (process.env.BW_NATIVE_MONTH_SHOT) {
      await wc!.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Month')?.click()")
      await new Promise((resolve) => setTimeout(resolve, 500))
      assert(await wc!.executeJavaScript("document.querySelector('[aria-label=\"Calendar view\"] [data-value=\"month\"]')?.getAttribute('aria-selected') === 'true'"), "Month view control follows the calendar")
      writeFileSync(process.env.BW_NATIVE_MONTH_SHOT, (await wc!.capturePage()).toPNG())
    }
    const sw = await wc!.executeJavaScript("navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(r => !!r).catch(() => false) : false")
    assert(sw === false, "Bundled workspace does not register the web service worker")
    app.exit(0)
  })().catch((error) => {
    console.error(error)
    app.exit(1)
  }).finally(() => {
    server.close()
    rmSync(userData, { recursive: true, force: true })
  })
})
