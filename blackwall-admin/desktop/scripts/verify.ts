/**
 * Drives the desktop shell end to end and captures screenshots.
 *
 *   npm run desktop:compile
 *   npx electron desktop/scripts/verify.ts <hosted-https-address> <screenshot-dir>
 *
 * Uses a throwaway userData folder and a local test server; works through the
 * real chrome UI (clicks and key events in the chrome page) so IPC is exercised.
 * Prints one line per check and exits non-zero if any check fails.
 */
import { BrowserWindow, Menu, app, nativeImage, screen } from "electron"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { startShell } from "../out/main/app.js"

const [hosted = "https://example.com/", shotDir = path.join(tmpdir(), "bw-shots")] = process.argv.slice(2).filter((a) => !a.startsWith("-") && !a.endsWith("verify.ts"))
const userData = mkdtempSync(path.join(tmpdir(), "bw-desktop-verify-"))
mkdirSync(shotDir, { recursive: true })

const FAVICON = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVR4nGP4z8DwnxLMMGrAqAGjBowaMGrAqAFDw4D/DAz/KcEMowaMGjBqwLAwAADTeX/hEEO0WgAAAABJRU5ErkJggg==",
  "base64",
)

function page(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><link rel="icon" href="/favicon.png">
<style>body{font:15px/1.5 -apple-system,sans-serif;background:#f6f7f9;color:#1f2228;margin:0;padding:32px 40px}h1{font-size:24px}.card{background:#fff;border:1px solid #dde1e6;border-radius:8px;padding:16px 20px;max-width:640px;margin-bottom:12px}a{color:#c92a2a}</style>
</head><body><h1>${title}</h1>${body}</body></html>`
}

function serve(port = 0): Promise<Server> {
  const server = createServer((req, res) => {
    const url = req.url ?? "/"
    if (url === "/favicon.png") return void res.writeHead(200, { "content-type": "image/png" }).end(FAVICON)
    const pages: Record<string, string> = {
      "/one": page(
        "Field notes",
        `<div class="card"><p>The needle is in the haystack. Another needle here.</p><p>And a third needle at the end.</p></div>
         <div class="card"><a id="blank" href="/two" target="_blank">Open “Reading list” in a new tab (target=_blank)</a><br>
         <button id="popup" onclick="window.open('/three')">window.open(“/three”)</button></div>`,
      ),
      "/two": page("Reading list", `<div class="card"><p>Opened from a target=_blank link.</p></div>`),
      "/three": page("Opened with window.open", `<div class="card"><p>Opened by window.open.</p></div>`),
    }
    const html = pages[url] ?? page("Test server", `<div class="card">${url}</div>`)
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html)
  })
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)))
}

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitFor<T>(fn: () => T | Promise<T>, ms = 15000): Promise<T | undefined> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await sleep(100)
  }
  return undefined
}

const shell = startShell({ userDataDir: userData })
if (!shell) throw new Error("single-instance lock not acquired")

// No top-level await: in an ESM main script it would hold back Electron's "ready" event.
void run()

async function run() {
  await shell.ready
  await shell.chromeReady()
  const win = shell.window()!
  const tabs = () => shell.tabs()!
  const ui = (js: string) => win.webContents.executeJavaScript(js)
  const visible = (id: string) => ui(`!document.getElementById(${JSON.stringify(id)}).hidden`) as Promise<boolean>
  const text = (sel: string) => ui(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`) as Promise<string>
  const idle = (wc = tabs().activeContents) => waitFor(async () => wc && !wc.isLoading() && wc.getURL() !== "" && (await sleep(300), !wc.isLoading()))
  /** Types into the chrome's address bar and presses Enter, like a user. */
  async function typeAddress(value: string) {
    await ui(`(() => { const a = document.getElementById("address"); a.focus(); a.value = ${JSON.stringify(value)};
      a.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })) })()`)
  }
  async function clickUi(sel: string) {
    await ui(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); document.querySelector(${JSON.stringify(sel)}).click()`)
  }

  /** Chrome strip + active tab view stitched into one PNG (both via webContents.capturePage). */
  async function capture(name: string) {
    try {
      await captureTo(name)
    } catch (e) {
      // e.g. the screen is locked or asleep: macOS gives no surface to capture.
      console.log(`SKIP  screenshot ${name}: ${(e as Error).message}`)
    }
  }

  async function captureTo(name: string) {
    await sleep(600)
    const { width, height } = win.getContentBounds()
    const scale = screen.getDisplayMatching(win.getBounds()).scaleFactor
    const top = await win.webContents.capturePage({ x: 0, y: 0, width, height: 78 })
    const wc = tabs().activeContents
    const viewVisible = wc && (await ui(`document.getElementById("panel-error").hidden && document.getElementById("panel-address").hidden`))
    const bottom = viewVisible ? await wc.capturePage() : await win.webContents.capturePage({ x: 0, y: 78, width, height: height - 78 })
    const parts = [top, bottom].map((img) => ({ size: img.getSize(scale), bmp: img.toBitmap({ scaleFactor: scale }) }))
    const w = parts[0].size.width
    const rows = parts.map((p) => {
      // Crop/pad each part to the same pixel width before stacking rows.
      const out = Buffer.alloc(w * 4 * p.size.height)
      const copy = Math.min(w, p.size.width) * 4
      for (let y = 0; y < p.size.height; y++) p.bmp.copy(out, y * w * 4, y * p.size.width * 4, y * p.size.width * 4 + copy)
      return out
    })
    const h = parts[0].size.height + parts[1].size.height
    const img = nativeImage.createFromBitmap(Buffer.concat(rows), { width: w, height: h, scaleFactor: scale })
    const file = path.join(shotDir, `${name}.png`)
    writeFileSync(file, img.toPNG())
    console.log(`SHOT  ${file} (${w}×${h}px)`)
  }

  const local = await serve()
  const base = `http://127.0.0.1:${(local.address() as AddressInfo).port}`

  try {
    // 1. First run: no web address yet → setup panel in the pinned tab.
    check("first run shows the web-address prompt", Boolean(await waitFor(() => visible("panel-address"), 5000)))
    check("first-run prompt has no Cancel", await ui(`document.getElementById("web-address-cancel").hidden`))
    await capture("00-first-run")

    // Invalid input is rejected with a message.
    await ui(`document.getElementById("web-address").value = "ftp://nope"; document.getElementById("address-setup").requestSubmit()`)
    check("invalid web address is rejected", Boolean(await waitFor(() => visible("web-address-error"), 3000)), await text("#web-address-error"))

    // 2. Set the hosted address through the form; the pinned tab loads it.
    await ui(`document.getElementById("web-address").value = ${JSON.stringify(hosted)}; document.getElementById("address-setup").requestSubmit()`)
    const pinned = await waitFor(() => tabs().pinned?.view?.webContents)
    await idle(pinned)
    check("pinned tab loads the hosted https address", !!pinned && pinned.getURL().startsWith(new URL(hosted).origin), pinned?.getURL())
    check("web address saved in userData config", shell.config.get().webAddress === new URL(hosted).href)
    check("address bar shows the lock for https", (await ui(`document.getElementById("security").className`)) === "secure")
    const sw = await waitFor(
      () => pinned?.executeJavaScript(`navigator.serviceWorker.getRegistration().then(r => r ? (r.active || r.installing || r.waiting).scriptURL : "")`),
      10000,
    )
    check("hosted Blackwall registers its service worker in the pinned tab", !!sw, String(sw || "no registration"))
    await pinned?.executeJavaScript("location.reload()")
    await idle(pinned)
    const controlled = await waitFor(() => pinned?.executeJavaScript("!!navigator.serviceWorker.controller"), 8000)
    check("service worker controls the page after reload", !!controlled)
    check("pinned tab has no preload/Node (require is undefined)", (await pinned?.executeJavaScript("typeof require + '/' + typeof process + '/' + typeof window.shell")) === "undefined/undefined/undefined")

    // 2b. A page in the pinned tab navigating to another site opens a new tab; the pinned tab stays.
    const pinnedBefore = pinned?.getURL()
    await pinned?.executeJavaScript(`location.href = "https://example.com/"`).catch(() => {})
    await waitFor(() => tabs().list().length === 2, 5000)
    check("pinned tab: link to another site opens a new tab", tabs().list().length === 2 && tabs().list()[1].url === "https://example.com/" && pinned?.getURL() === pinnedBefore, `${tabs().list().length} tabs, pinned at ${pinned?.getURL()}`)
    tabs().close(tabs().list()[1].id)
    tabs().activate(tabs().pinned!.id)

    // 3. New tab from the chrome's + button, then type a bare host in the address bar.
    await clickUi("#new-tab")
    check("+ opens a new tab and focuses the address bar", tabs().list().length === 2 && (await ui(`document.activeElement.id`)) === "address")
    check("new tab shows the blank-page hint", await visible("panel-new"))
    await typeAddress(base.replace("http://", "") + "/one")
    await idle()
    check("address bar loads a bare host:port as http", tabs().activeContents?.getURL() === `${base}/one`, tabs().activeContents?.getURL())
    check("http page shows the open-lock indicator", (await ui(`document.getElementById("security").className`)) === "insecure")
    await waitFor(async () => (await text(".tab.active .title")) === "Field notes", 5000)
    check("tab shows the page title", (await text(".tab.active .title")) === "Field notes")
    const icon = await waitFor(() => ui(`document.querySelector(".tab.active .favicon img")?.src ?? ""`), 5000)
    check("tab shows the favicon (fetched by main, passed as data:)", String(icon).startsWith("data:image/png"), String(icon).slice(0, 30))

    // 4. target=_blank and window.open open tabs, never windows.
    const one = tabs().activeContents!
    await one.executeJavaScript(`document.getElementById("blank").click()`, true)
    await waitFor(() => tabs().list().length === 3)
    await idle()
    check("target=_blank opens a new tab", tabs().list().length === 3 && tabs().activeContents?.getURL() === `${base}/two`, tabs().activeContents?.getURL())
    await clickUi(`.tab[data-id="${tabs().list()[1].id}"]`)
    await one.executeJavaScript(`document.getElementById("popup").click()`, true)
    await waitFor(() => tabs().list().length === 4)
    await idle()
    check("window.open opens a new tab", tabs().list().length === 4 && tabs().activeContents?.getURL() === `${base}/three`, tabs().activeContents?.getURL())
    check("no extra BrowserWindow was created", BrowserWindow.getAllWindows().length === 1)

    // 5. Search: text that isn't a URL goes to DuckDuckGo.
    await typeAddress("blackwall electron shell")
    await waitFor(() => tabs().activeContents?.getURL().startsWith("https://duckduckgo.com/"), 15000)
    check("non-URL text searches DuckDuckGo", !!tabs().activeContents?.getURL().startsWith("https://duckduckgo.com/"), tabs().activeContents?.getURL())

    // 6. Back / forward through the menu actions.
    const menu = Menu.getApplicationMenu()!
    const item = (label: string) => menu.items.flatMap((m) => m.submenu?.items ?? []).find((i) => i.label === label)!
    item("Back").click()
    await waitFor(() => tabs().activeContents?.getURL() === `${base}/three`, 8000)
    check("History → Back goes back", tabs().activeContents?.getURL() === `${base}/three`)
    item("Forward").click()
    await waitFor(() => tabs().activeContents?.getURL().startsWith("https://duckduckgo.com/"), 8000)
    check("History → Forward goes forward", !!tabs().activeContents?.getURL().startsWith("https://duckduckgo.com/"))

    // 7. Close tabs with the × button; the pinned tab has none and refuses close.
    const closeId = tabs().active!.id
    await ui(`document.querySelector('.tab[data-id="${closeId}"] .close').click()`)
    await waitFor(() => tabs().list().length === 3)
    check("× closes a tab", tabs().list().length === 3)
    check("pinned tab has no close button", !(await ui(`!!document.querySelector(".tab.pinned .close")`)))
    item("Close Tab").click() // active is /three now? close it via the menu too
    check("File → Close Tab closes the active tab", tabs().list().length === 2)
    tabs().activate(tabs().pinned!.id)
    item("Close Tab").click()
    check("Close Tab on the pinned tab does nothing", tabs().list().length === 2 && tabs().active?.kind === "blackwall")

    // 8. Find in page.
    await clickUi(`.tab[data-id="${tabs().list()[1].id}"]`)
    await idle()
    item("Find…").click()
    check("Edit → Find… opens the find bar with focus", (await visible("find")) && (await ui(`document.activeElement.id`)) === "find-input")
    await ui(`const f = document.getElementById("find-input"); f.value = "needle"; f.dispatchEvent(new Event("input"))`)
    const count = await waitFor(async () => (await text("#find-count")) === "1 of 3" && "1 of 3", 5000)
    check("find reports matches", count === "1 of 3", String(count))
    await ui(`document.getElementById("find-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))`)
    await waitFor(async () => (await text("#find-count")) === "2 of 3", 3000)
    check("Enter moves to the next match", (await text("#find-count")) === "2 of 3", await text("#find-count"))
    await capture("05-find-in-page")
    await ui(`document.getElementById("find-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`)
    check("Escape closes the find bar", !(await visible("find")))

    // 9. Two user tabs + pinned, windowed and fullscreen screenshots.
    tabs().add({ kind: "web", url: `${base}/two` }, { activate: false })
    await sleep(300)
    check("an unloaded background tab is labelled with its host", (await text(".tab:last-child .title")) === new URL(base).host, await text(".tab:last-child .title"))
    await clickUi(`.tab[data-id="${tabs().list()[1].id}"]`)
    await idle()
    await capture("01-windowed-three-tabs")
    tabs().activate(tabs().pinned!.id)
    await idle(pinned)
    await capture("02-windowed-pinned-active")
    win.setFullScreen(true)
    await waitFor(() => win.isFullScreen(), 5000)
    await sleep(1200)
    check("window enters fullscreen", win.isFullScreen())
    check("chrome drops the traffic-light inset in fullscreen", await ui(`document.body.classList.contains("fullscreen")`))
    await capture("03-fullscreen-pinned-active")
    await clickUi(`.tab[data-id="${tabs().list()[1].id}"]`)
    await capture("04-fullscreen-user-tab")
    win.setFullScreen(false)
    await waitFor(() => !win.isFullScreen(), 5000)
    await sleep(1000)

    // 10. Unreachable address → error panel with Retry; Retry succeeds once the server is up.
    const probe = await serve()
    const deadPort = (probe.address() as AddressInfo).port
    await new Promise((r) => probe.close(r))
    await typeAddress(`127.0.0.1:${deadPort}/one`)
    check("unreachable address shows the error panel", Boolean(await waitFor(() => visible("panel-error"), 10000)), `${await text("#error-title")} / ${await text("#error-code")}`)
    check("tab view is hidden behind the error panel (not blank)", tabs().active?.view?.getVisible() === false)
    await capture("06-error-unreachable")
    const revived = await serve(deadPort)
    await clickUi("#error-retry")
    await idle()
    check("Retry loads the page once the server answers", !(await visible("panel-error")) && tabs().activeContents?.getURL() === `http://127.0.0.1:${deadPort}/one`)
    await new Promise((r) => revived.close(r))

    // 11. Renderer crash → crash panel → Retry.
    tabs().activeContents?.forcefullyCrashRenderer()
    check("crashed tab shows the crash panel", Boolean(await waitFor(() => visible("panel-error"), 5000)), await text("#error-title"))
    await capture("07-error-crash")
    const again = await serve(deadPort)
    await clickUi("#error-retry")
    await idle()
    check("Retry after a crash reloads the page", !(await visible("panel-error")) && (await tabs().activeContents?.executeJavaScript("document.title")) === "Field notes")
    await new Promise((r) => again.close(r))

    // 12. Menu "Web Address…" opens the prompt with Cancel; Cancel restores the view.
    item("Web Address…").click()
    const opened = await waitFor(() => visible("panel-address"), 3000)
    check("Web Address… opens the prompt over the page", !!opened && !(await ui(`document.getElementById("web-address-cancel").hidden`)) && tabs().active?.view?.getVisible() === false)
    await clickUi("#web-address-cancel")
    await waitFor(async () => !(await visible("panel-address")), 3000)
    check("Cancel closes it and shows the tab again", !(await visible("panel-address")) && tabs().active?.view?.getVisible() === true)

    // 13. Chrome page is locked: no navigation away from bw-shell://.
    await ui(`location.href = "https://example.com/"`).catch(() => {})
    await sleep(800)
    check("chrome page can't navigate away", win.webContents.getURL() === "bw-shell://chrome/index.html", win.webContents.getURL())
    const fromTab = await tabs().activeContents?.executeJavaScript(`fetch("bw-shell://chrome/index.html").then(() => "loaded", e => "blocked: " + e.message)`)
    check("web tabs can't load the chrome's bw-shell:// files", String(fromTab).startsWith("blocked"), String(fromTab))

    // 13b. Shortcuts: every binding is on its menu item, and each action works.
    const expected: [string, string][] = [
      ["New Tab", "CmdOrCtrl+T"], ["Close Tab", "CmdOrCtrl+W"], ["Open Location…", "CmdOrCtrl+L"],
      ["Back", "CmdOrCtrl+["], ["Forward", "CmdOrCtrl+]"], ["Reload Page", "CmdOrCtrl+R"], ["Find…", "CmdOrCtrl+F"],
      ["Show Previous Tab", "CmdOrCtrl+Shift+["], ["Show Next Tab", "CmdOrCtrl+Shift+]"],
      ["Zoom In", "CmdOrCtrl+="], ["Zoom Out", "CmdOrCtrl+-"], ["Actual Size", "CmdOrCtrl+0"],
    ]
    for (const [label, accel] of expected) check(`menu: ${label} is bound to ${accel}`, item(label)?.accelerator === accel, String(item(label)?.accelerator))
    const roles = menu.items.flatMap((m) => m.submenu?.items ?? []).map((i) => i.role).filter(Boolean)
    check("menu has the standard roles (undo/redo/cut/copy/paste/selectAll/minimize/zoom/togglefullscreen/quit)", ["undo", "redo", "cut", "copy", "paste", "selectall", "minimize", "zoom", "togglefullscreen", "quit"].every((r) => roles.map((x) => String(x).toLowerCase()).includes(r)), roles.join(","))
    const tabCount = tabs().list().length
    item("New Tab").click()
    await sleep(300)
    check("New Tab adds a tab and focuses the address bar", tabs().list().length === tabCount + 1 && (await ui(`document.activeElement.id`)) === "address")
    item("Close Tab").click()
    await sleep(200)
    check("Close Tab removes it again", tabs().list().length === tabCount)
    await ui(`document.activeElement.blur()`)
    item("Open Location…").click()
    await sleep(300)
    check("Open Location… focuses and selects the address bar", (await ui(`document.activeElement.id === "address" && document.activeElement.selectionEnd - document.activeElement.selectionStart === document.activeElement.value.length`)) === true)
    const order = () => tabs().list().map((t) => t.id)
    const idx = () => order().indexOf(tabs().activeTabId)
    const startIdx = idx()
    item("Show Next Tab").click()
    check("Show Next Tab moves right (wrapping)", idx() === (startIdx + 1) % order().length)
    item("Show Previous Tab").click()
    check("Show Previous Tab moves back", idx() === startIdx)
    // Cmd+1…9 go through before-input-event (sendInputEvent goes through the same path a real key press does).
    for (const [key, want] of [["1", 0], ["2", 1], ["9", order().length - 1]] as const) {
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: key, modifiers: ["meta"] })
      await sleep(150)
      check(`Cmd+${key} selects tab ${want + 1}`, idx() === want, `active index ${idx()}`)
    }
    const pageWc = tabs().activeContents!
    pageWc.sendInputEvent({ type: "keyDown", keyCode: "1", modifiers: ["meta"] })
    await sleep(150)
    check("Cmd+1 also works while a web page has focus", idx() === 0)
    tabs().activate(tabs().list().find((t) => t.url.startsWith(base))!.id)
    await idle()
    const z = () => tabs().activeContents!.getZoomLevel()
    item("Zoom In").click()
    check("Zoom In zooms the page, not the chrome", z() === 1 && win.webContents.getZoomLevel() === 0)
    item("Zoom Out").click()
    item("Zoom Out").click()
    check("Zoom Out", z() === -1)
    item("Actual Size").click()
    check("Actual Size resets zoom", z() === 0)
    await tabs().activeContents!.executeJavaScript(`window.__beforeReload = true`)
    item("Reload Page").click()
    await sleep(300)
    await idle()
    check("Reload Page reloads the active tab", (await tabs().activeContents!.executeJavaScript(`window.__beforeReload === undefined && performance.getEntriesByType("navigation")[0].type`)) === "reload")

    // 14. Saved state for restore.
    shell.config.flush()
    const saved = shell.config.get()
    check("open tabs are saved for restore", saved.tabs.length === tabs().list().length - 1, JSON.stringify(saved.tabs.map((t) => t.url)))

    // 15. Close the window (app stays in the Dock), reopen it: tabs come back from the saved config.
    const before = tabs().list().map((t) => t.url)
    check("window has a minimum size of 640×420", JSON.stringify(win.getMinimumSize()) === "[640,420]", JSON.stringify(win.getMinimumSize()))
    const area = screen.getDisplayMatching(win.getBounds()).workArea
    const wanted = { x: area.x + 60, y: area.y + 40, width: 1100, height: 720 }
    win.setBounds(wanted)
    await sleep(500)
    item("Close Window").click()
    await waitFor(() => !shell.window(), 5000)
    check("Close Window closes the window, app keeps running", !shell.window() && BrowserWindow.getAllWindows().length === 0)
    app.emit("activate")
    await waitFor(() => shell.window(), 5000)
    await shell.chromeReady()
    await idle(shell.tabs()?.pinned?.view?.webContents)
    const after = shell.tabs()!.list().map((t) => t.url)
    const b = shell.window()!.getBounds()
    check("reopened window has the saved size and position", b.x === wanted.x && b.y === wanted.y && b.width === wanted.width && b.height === wanted.height, `${JSON.stringify(wanted)} → ${JSON.stringify(b)}`)
    check("reopening restores the same tabs", JSON.stringify(after) === JSON.stringify(before), JSON.stringify(after))
  } catch (e) {
    failures++
    console.error("ERROR", e)
  } finally {
    local.close()
    console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed")
    app.exit(failures ? 1 : 0)
    rmSync(userData, { recursive: true, force: true })
  }
}
