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
    // The workspace is the app: it draws its own title bar and no browser chrome shows; a browser tab brings it back.
    const tabs = controller.tabs()!
    const pinned = tabs.pinned!
    assert(tabs.solo && tabs.chromeMode() === "hidden" && pinned.view!.getBounds().y === 0, "Blackwall workspace fills the window and draws its own title bar")
    const browserTab = tabs.add({ kind: "web", url: null }, { activate: true })
    assert(!tabs.solo && tabs.chromeMode() === "full", "A browser tab brings back the tab strip and address bar")
    tabs.close(browserTab)
    tabs.activate(pinned.id)
    assert(tabs.solo && tabs.chromeMode() === "hidden" && pinned.view!.getBounds().y === 0, "Closing the browser tab returns to the plain workspace")
    const utilityStyles = await wc!.executeJavaScript(`(() => {
      const probe = document.createElement('div');
      probe.className = 'fixed flex items-center';
      document.body.append(probe);
      const style = getComputedStyle(probe);
      const result = { position: style.position, display: style.display, alignItems: style.alignItems };
      probe.remove();
      return result;
    })()`)
    assert(utilityStyles.position === "fixed" && utilityStyles.display === "flex" && utilityStyles.alignItems === "center", "Shared page utilities are present in the Mac bundle")
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
    assert(await wc!.executeJavaScript("!!document.querySelector('.mac-dw-desktop')"), "Mac workspace opens as a desktop")
    const logInput = (selector: string, value: string) => `(() => { const field = document.querySelector(${JSON.stringify(selector)}); if (!field) return false; const set = Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); return true })()`
    assert(!await wc!.executeJavaScript("!!document.querySelector('.mac-dw-sidebar')"), "Planner sidebar starts closed")
    await wc!.executeJavaScript("document.querySelector('.mac-dw-date').click()")
    assert(await wc!.executeJavaScript("!!document.querySelector('.mac-dw-sidebar [role=grid]') && !!document.querySelector('.mac-dw-sidebar .mac-task-list, .mac-dw-sidebar .mac-tool-empty') && !!document.querySelector('.mac-dw-sidebar .mac-log-tool')"), "Date button opens the Planner sidebar with calendar, tasks and daily log")
    await wc!.executeJavaScript("document.querySelector('.mac-log-add').click()")
    assert(await wc!.executeJavaScript(logInput('.mac-log-name input', 'Build notes')), "Daily log accepts a section name")
    await wc!.executeJavaScript("document.querySelector('.mac-log-name .is-primary').click()")
    assert(await wc!.executeJavaScript("!!Array.from(document.querySelectorAll('.mac-log-group-head strong')).find((node) => node.textContent === 'Build notes')"), "Daily log saves a named section")
    assert(await wc!.executeJavaScript(logInput('textarea[aria-label="New Build notes entry"]', 'Compact Mac reflection')), "Daily log accepts an entry draft")
    await wc!.executeJavaScript("Array.from(document.querySelectorAll('.mac-log-group')).find((group) => group.textContent.includes('Build notes')).querySelector('.mac-log-actions .is-primary').click()")
    assert(await wc!.executeJavaScript("!!Array.from(document.querySelectorAll('.mac-log-item-text')).find((node) => node.textContent === 'Compact Mac reflection')"), "Daily log saves an entry in its section")
    await wc!.executeJavaScript("Array.from(document.querySelectorAll('.mac-log-item-text')).find((node) => node.textContent === 'Compact Mac reflection').click()")
    assert(await wc!.executeJavaScript(logInput('textarea[aria-label="Edit Build notes entry"]', 'Edited Mac reflection')), "Daily log opens a saved entry for editing")
    await wc!.executeJavaScript("Array.from(document.querySelectorAll('.mac-log-item')).find((row) => row.querySelector('textarea')).querySelector('.is-primary').click()")
    assert(await wc!.executeJavaScript("!!Array.from(document.querySelectorAll('.mac-log-item-text')).find((node) => node.textContent === 'Edited Mac reflection')"), "Daily log saves an edited entry")
    await wc!.executeJavaScript("Array.from(document.querySelectorAll('.mac-log-group-head strong')).find((node) => node.textContent === 'Build notes').closest('button').click()")
    assert(await wc!.executeJavaScript("Array.from(document.querySelectorAll('.mac-log-group-head strong')).find((node) => node.textContent === 'Build notes').closest('button').getAttribute('aria-expanded') === 'false'"), "Daily log section collapses")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Open Learning\"]').click()")
    for (let i = 0; i < 40; i++) {
      if (await wc!.executeJavaScript("!!document.querySelector('[aria-label=\"Learning window\"] .mac-dw-app-main')?.textContent?.trim()")) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert(await wc!.executeJavaScript("!!document.querySelector('[aria-label=\"Learning window\"] .mac-dw-app-main')?.textContent?.trim()"), "Learning opens in its own app window")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Open Projects\"]').click()")
    assert(await wc!.executeJavaScript("!!document.querySelector('[aria-label=\"Learning window\"]') && !!document.querySelector('[aria-label=\"Projects window\"]')"), "Opening Projects leaves Learning open")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Close projects window\"]').click()")
    assert(await wc!.executeJavaScript("!document.querySelector('[aria-label=\"Projects window\"]') && !!document.querySelector('[aria-label=\"Learning window\"]')"), "Closing Projects leaves Learning open")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Open Projects\"]').click()")
    assert(await wc!.executeJavaScript("!!document.querySelector('[aria-label=\"Projects window\"]')"), "Projects reopens from the compact launcher")
    if (process.env.BW_DESKTOP_SHOT) writeFileSync(process.env.BW_DESKTOP_SHOT, (await wc!.capturePage()).toPNG())
    await wc!.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
    assert(await wc!.executeJavaScript("!document.querySelector('.mac-dw-sidebar')"), "Escape closes the Planner sidebar")
    // Window controls: the bigger button swaps to "smaller", minimize leaves only the title bar, and the rail can close a window.
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Expand learning window\"]').click()")
    assert(await wc!.executeJavaScript("!!document.querySelector('button[aria-label=\"Restore learning window\"]')"), "An expanded window offers to make itself smaller")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Restore learning window\"]').click()")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Minimize learning window\"]').click()")
    assert(await wc!.executeJavaScript("document.querySelector('[aria-label=\"Learning window\"]').getBoundingClientRect().height <= 34"), "Minimize leaves just the title bar")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Show learning window\"]').click()")
    assert(await wc!.executeJavaScript("document.querySelector('[aria-label=\"Learning window\"]').getBoundingClientRect().height > 100"), "The window comes back from the title bar")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Close Learning window\"]').click()")
    assert(await wc!.executeJavaScript("!document.querySelector('[aria-label=\"Learning window\"]')"), "The sidebar closes an open window")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Open Learning\"]').click()")
    assert(await wc!.executeJavaScript("!!document.querySelector('[aria-label=\"Learning window\"]')"), "Learning reopens from the sidebar")
    // The create menu opens the task form (a selector that built a new array on every render once crashed it).
    const clickAt = async (selector: string, text: string) => {
      const point = await wc!.executeJavaScript(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)})) ?? document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`)
      assert(!!point, `Found ${selector}`)
      for (const type of ["mouseMove", "mouseDown", "mouseUp"] as const) wc!.sendInputEvent({ type, x: point.x, y: point.y, button: "left", clickCount: 1 })
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
    await clickAt("button[aria-label='Create new']", "")
    await clickAt("[role=menuitem]", "Task")
    assert(await wc!.executeJavaScript("!!document.querySelector('#task-title') && !document.body.innerText.includes('Something broke')"), "Create → Task opens the task form without crashing")
    await wc!.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
    await new Promise((resolve) => setTimeout(resolve, 300))
    // Rail names: the toggle writes the names beside the icons and moves the windows over.
    await wc!.executeJavaScript("document.querySelector('.mac-dw-rail-toggle').click()")
    assert(await wc!.executeJavaScript("document.querySelector('.mac-dw-rail').dataset.labels === 'true' && [...document.querySelectorAll('.mac-dw-rail-label')].some(e => e.textContent === 'Learning')"), "The sidebar toggle shows app names")
    assert(await wc!.executeJavaScript("(() => { const w = document.querySelector('[aria-label=\"Learning window\"]').getBoundingClientRect(); return w.right <= window.innerWidth + 1 && w.left >= document.querySelector('.mac-dw-rail').getBoundingClientRect().right - 1 })()"), "Windows stay inside the screen and clear of the wide sidebar")
    await wc!.executeJavaScript("document.querySelector('.mac-dw-rail-toggle').click()")
    assert(await wc!.executeJavaScript("document.querySelector('.mac-dw-rail').dataset.labels === 'false'"), "The sidebar toggle hides names again")
    // Settings: Desktop and Learning sections exist, and a theme choice reaches the page.
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Open Settings\"]').click()")
    assert(await wc!.executeJavaScript("(() => { const names = [...document.querySelectorAll('nav[aria-label=\"Settings sections\"] button')].map(b => b.textContent); return names.includes('Desktop') && names.includes('Learning') && names.includes('Appearance') })()"), "Settings has Desktop, Learning and Appearance sections")
    await wc!.executeJavaScript("[...document.querySelectorAll('nav[aria-label=\"Settings sections\"] button')].find(b => b.textContent === 'Appearance').click()")
    await wc!.executeJavaScript("document.querySelector('[role=radio][title=\"Bright and clean\"]').click()")
    assert(await wc!.executeJavaScript("document.documentElement.dataset.theme === 'light' && !document.documentElement.classList.contains('dark')"), "Choosing the Light theme applies it")
    await wc!.executeJavaScript("document.querySelector('[role=radio][title=\"Neutral grey, the Mac desktop look\"]').click()")
    assert(await wc!.executeJavaScript("document.documentElement.dataset.theme === 'graphite'"), "Graphite is the Mac theme")
    await wc!.executeJavaScript("document.querySelector('button[data-slot=dialog-close]').click()")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Open classic workspace\"]').click()")
    for (let i = 0; i < 40; i++) {
      if (await wc!.executeJavaScript("!!document.querySelector('.mac-titlebar') && !!document.querySelector('.mac-dock')")) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const macFrame = await wc!.executeJavaScript(`({
      titlebar: !!document.querySelector('.mac-titlebar .mac-search'),
      sections: !!document.querySelector('.mac-navigator'),
      dock: !!document.querySelector('.mac-dock'),
      status: !!document.querySelector('.mac-statusbar'),
      hostedShell: !!document.querySelector('.bw-app-shell'),
      focusedEditor: document.activeElement?.matches('input, textarea, [contenteditable=true]') ?? false,
    })`)
    assert(macFrame.titlebar && macFrame.sections && macFrame.dock && macFrame.status && !macFrame.hostedShell, `Mac workspace has its own title bar, navigation, tool dock and status bar (${JSON.stringify(macFrame)})`)
    assert(!macFrame.focusedEditor, "Mac workspace does not focus an editor on arrival")
    const headerHeight = await wc!.executeJavaScript("document.querySelector('.mac-titlebar')?.getBoundingClientRect().height")
    assert(headerHeight >= 36 && headerHeight <= 46, "Mac title bar stays compact")
    // Something scrolling an element into view must not push the whole frame (and its title bar) out of place.
    const framePushed = await wc!.executeJavaScript(`(() => {
      const shell = document.querySelector('.mac-shell')
      shell.scrollTop = 40
      document.querySelector('.mac-statusbar').scrollIntoView({ block: 'start' })
      const moved = shell.scrollTop
      shell.scrollTop = 0
      return { moved, titlebarTop: document.querySelector('.mac-titlebar').getBoundingClientRect().top }
    })()`)
    assert(framePushed.moved === 0 && framePushed.titlebarTop === 0, `The frame can't be scrolled out of place (${JSON.stringify(framePushed)})`)
    // The window tells the page how it is framed, so the title bar leaves room for the traffic lights.
    const frame = await wc!.executeJavaScript("({ chrome: document.documentElement.dataset.chrome, fullscreen: document.documentElement.dataset.fullscreen, pad: getComputedStyle(document.querySelector('.mac-titlebar')).paddingLeft })")
    assert(frame.chrome === "hidden" && frame.fullscreen === "false" && frame.pad === "82px", `Title bar leaves room for the window buttons (${JSON.stringify(frame)})`)

    // The Tool Dock: Planner tools on the right, navigation only on the left.
    const dockTools = await wc!.executeJavaScript("Array.from(document.querySelectorAll('.mac-dock .mac-tool')).map((t) => t.dataset.tool)")
    assert(JSON.stringify(dockTools) === JSON.stringify(["calendar", "today", "log"]), `Dock opens with Calendar, Tasks and Daily log (${JSON.stringify(dockTools)})`)
    await wc!.executeJavaScript("document.querySelector('[data-tool=today] .mac-tool-toggle').click()")
    assert(await wc!.executeJavaScript("!document.querySelector('[data-tool=today] .mac-tool-body')"), "A dock tool collapses to its title bar")
    await wc!.executeJavaScript("document.querySelector('[data-tool=today] .mac-tool-toggle').click()")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Hide tools\"]').click()")
    assert(await wc!.executeJavaScript("!document.querySelector('.mac-dock')"), "The dock hides from the title bar")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Show tools\"]').click()")
    assert(await wc!.executeJavaScript("!!document.querySelector('.mac-dock [data-tool=log]')"), "The dock comes back with the same tools")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Remove Daily log from the dock\"]').click()")
    assert(await wc!.executeJavaScript("!document.querySelector('[data-tool=log]') && !!document.querySelector('[data-tool=calendar]')"), "A tool can be removed from the dock")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Hide navigation\"]').click()")
    assert(await wc!.executeJavaScript("!document.querySelector('.mac-navigator')"), "The navigation sidebar hides from the title bar")
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Show navigation\"]').click()")

    // The Browser button opens a browser tab; the tab strip appears and the workspace gets a strip above it.
    await wc!.executeJavaScript("document.querySelector('button[aria-label=\"Open a browser tab\"]').click()")
    for (let i = 0; i < 30 && tabs.solo; i++) await new Promise((resolve) => setTimeout(resolve, 100))
    assert(!tabs.solo && tabs.chromeMode() === "full", "The title bar's Browser button opens a browser tab")
    const browserTabId = tabs.list().find((t) => t.kind === "web")!.id
    tabs.close(browserTabId)
    tabs.activate(pinned.id)
    for (let i = 0; i < 30 && !tabs.solo; i++) await new Promise((resolve) => setTimeout(resolve, 100))
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
    for (let i = 0; i < 40; i++) {
      if (await wc!.executeJavaScript("!!document.querySelector('a.mac-nav-child[href=\"/productivity/learning\"]')")) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert(await wc!.executeJavaScript("!!document.querySelector('a.mac-nav-child[href=\"/productivity/learning\"]')"), "Learning appears in the Mac section tree")
    await wc!.executeJavaScript("document.querySelector('a.mac-nav-child[href=\"/productivity/learning\"]').click()")
    for (let i = 0; i < 40; i++) {
      if (await wc!.executeJavaScript("document.querySelector('.mac-page-title h1')?.textContent === 'Learning'")) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const learningNavigation = await wc!.executeJavaScript("({ path: location.pathname, title: document.querySelector('.mac-page-title h1')?.textContent, link: !!document.querySelector('a.mac-nav-child[href=\"/productivity/learning\"]') })")
    assert(learningNavigation.path === "/productivity/learning" && learningNavigation.title === "Learning", `Section tree opens Learning inside the Mac workspace (${JSON.stringify(learningNavigation)})`)
    await wc!.executeJavaScript("document.querySelector('a.mac-nav-parent[href=\"/\"]')?.click()")
    for (let i = 0; i < 40; i++) {
      if (await wc!.executeJavaScript("!!document.querySelector('[data-testid=home-grid]')")) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const homeLayout = await wc!.executeJavaScript(`(() => {
      const grid = document.querySelector('[data-testid=home-grid]');
      if (!grid) return null;
      return { display: getComputedStyle(grid).display, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length };
    })()`)
    assert(homeLayout?.display === "grid" && homeLayout.columns >= 2, `Home panels use their desktop grid (${JSON.stringify(homeLayout)})`)
    // The Mac app's own updater: private to the bundled workspace, and visible in Settings → About.
    const bare = await wc!.executeJavaScript("fetch('/__mac/update/status').then((r) => r.status)")
    assert(bare === 404, "Updater endpoints refuse requests without the app header")
    const updateStatus = await wc!.executeJavaScript("fetch('/__mac/update/status', { headers: { 'X-Blackwall': '1' } }).then((r) => r.json())")
    assert(updateStatus.state === "idle" && typeof updateStatus.version === "string", `Updater reports its status (${JSON.stringify(updateStatus)})`)
    await wc!.executeJavaScript("location.href = '/settings/about'")
    const waitFor = async (script: string) => {
      for (let i = 0; i < 60; i++) {
        if (await wc!.executeJavaScript(script).catch(() => false)) return true
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return false
    }
    const panelButton = "Array.from(document.querySelectorAll('[role=status] button')).find((b) => b.textContent?.trim() === 'Check for updates')"
    assert(await waitFor(`!!(${panelButton})`), "Settings → About shows the Mac update button")
    await wc!.executeJavaScript(`(${panelButton}).click()`)
    assert(await waitFor("document.body.textContent?.includes('No newer Mac build has been published yet')"), "Check for updates reports when nothing is published")
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
