# Desktop app, Phase 1: report

Branch `desktop-shell`, Nov 2, 2026. This covers what was built, what each verification step actually showed, what doesn't work yet, and why each decision was made. Everything marked as working below was run on this Mac (Apple silicon, `arm64`, macOS 27.0.1, Node 24.15).

The real server address used in these runs is written as `blackwall.example.ts.net` throughout this report, the tests and the screenshots. The address is something you type into the app; it is never built in.

## Result

A macOS Electron app in `blackwall-admin/desktop/`. It has a hiddenInset window with its own tab strip and toolbar in Blackwall's Dim colors. The pinned **Blackwall** tab loads the hosted web app, user tabs are normal browser tabs, and native menus and shortcuts work. The built app is unsigned (ad-hoc), at `release/mac-arm64/Blackwall.app` and `release/Blackwall-0.1.0-arm64.dmg`.

The web app's pages, styles, themes, routes, server and data were not touched. Outside `desktop/`, the only changes are:

- `package.json`: two devDependencies and new scripts.
- `package-lock.json`: additions only.
- `.gitignore` and `.oxlintrc.json`: ignore build output.
- `README.md`: a new section.
- `docs/`: this report and the screenshots.

## What was built

| Area | Files |
| --- | --- |
| App entry, window, menu wiring, IPC, lifecycle | `desktop/src/main/app.ts`, `main.ts`, `menu.ts` |
| Tabs (one `WebContentsView` each), link rules, error/crash state, context menu, favicons | `desktop/src/main/tabs.ts` |
| Tab session hardening (partition, permissions, downloads, certificates, UA) | `desktop/src/main/web-session.ts` |
| Config in userData (web address, window, tabs) | `desktop/src/main/config.ts` |
| Address-bar parsing and link classification (pure, unit-tested) | `desktop/src/main/url.ts`, `desktop/tests/*.test.ts` |
| Chrome UI preload (the only preload; `window.shell`) | `desktop/src/preload/chrome.cts` |
| Chrome UI: tab strip, toolbar, find bar, setup/error panels | `desktop/src/chrome/chrome.ts`, `desktop/static/index.html`, `chrome.css` |
| Message types shared by main and chrome | `desktop/src/shared/ipc.ts` |
| Build | `desktop/electron-builder.yml`, `desktop/scripts/build.ts`, `desktop/scripts/copy-static.ts`, `desktop/package.json`, `desktop/tsconfig*.json` |
| End-to-end check and screenshots | `desktop/scripts/verify.ts` |

Scripts: `desktop:dev`, `desktop:build`, `desktop:compile`, `desktop:test`. `typecheck` (and so `check`) now also runs `tsc -b desktop`. `npm run build`, which the Docker image runs, is unchanged.

**Structure for the future Native tab.** Tabs have a `kind` (`"blackwall"` | `"web"`), and the window and chrome only depend on `pinned` and a view. A pinned `"native"` kind would load the bundled UI from its own scheme or session with its own preload, added beside the existing kinds. None of it is built.

## Verification: what actually ran

### 1. `npm run check`, existing tests, new unit tests

- `npm run check` exited 0. oxlint reports no warnings in `desktop/`; the warnings it prints are the pre-existing `react(purity)` ones in `src/`. The Vite build printed `✓ built in 406ms`.
- `node --test tests/*.test.ts` (existing): `tests 31 · pass 30 · fail 0 · skipped 1`. The skipped test is the Postgres test, which needs `TEST_DATABASE_URL`.
- `npm run desktop:test`: `pass 7 · fail 0`. It covers the address bar (URLs, bare hosts, `localhost:5173`, `mikoshi:8780`, searches), never producing `javascript:`/`file:`/`data:`/`bw-shell:` URLs, link classes, web-address validation, and config sanitizing plus an atomic write with mode 600.
- Lockfile check: no existing package changed version or was removed. A script compared the old and new `package-lock.json`: `old-version-missing: 0, gone: [], dev flag flips 0`.

### 2. `desktop:dev` / end-to-end script (dev Electron 44.10.1)

`npx electron desktop/scripts/verify.ts https://blackwall.example.ts.net/ <dir>` uses a throwaway profile and a local test server. It drives the app through the real chrome UI (clicks and key events in the chrome page), so the IPC is exercised. Final run: **73 checks, all passed, exit 0**. Output:

```text
PASS  first run shows the web-address prompt
PASS  first-run prompt has no Cancel
PASS  invalid web address is rejected  — Enter a web address that starts with https:// (or http://).
PASS  pinned tab loads the hosted https address  — https://blackwall.example.ts.net/
PASS  web address saved in userData config
PASS  address bar shows the lock for https
PASS  hosted Blackwall registers its service worker in the pinned tab  — https://blackwall.example.ts.net/sw.js
PASS  service worker controls the page after reload
PASS  pinned tab has no preload/Node (require is undefined)
PASS  pinned tab: link to another site opens a new tab  — 2 tabs, pinned at https://blackwall.example.ts.net/
PASS  + opens a new tab and focuses the address bar
PASS  new tab shows the blank-page hint
PASS  address bar loads a bare host:port as http  — http://127.0.0.1:<port>/one
PASS  http page shows the open-lock indicator
PASS  tab shows the page title
PASS  tab shows the favicon (fetched by main, passed as data:)  — data:image/png;base64,iVBORw0K
PASS  target=_blank opens a new tab  — http://127.0.0.1:<port>/two
PASS  window.open opens a new tab  — http://127.0.0.1:<port>/three
PASS  no extra BrowserWindow was created
PASS  non-URL text searches DuckDuckGo  — https://duckduckgo.com/?q=blackwall%20electron%20shell
PASS  History → Back goes back
PASS  History → Forward goes forward
PASS  × closes a tab
PASS  pinned tab has no close button
PASS  File → Close Tab closes the active tab
PASS  Close Tab on the pinned tab does nothing
PASS  Edit → Find… opens the find bar with focus
PASS  find reports matches  — 1 of 3
PASS  Enter moves to the next match  — 2 of 3
PASS  Escape closes the find bar
PASS  an unloaded background tab is labelled with its host  — 127.0.0.1:<port>
PASS  window enters fullscreen
PASS  chrome drops the traffic-light inset in fullscreen
PASS  unreachable address shows the error panel  — Can’t reach this page / ERR_CONNECTION_REFUSED (-102)
PASS  tab view is hidden behind the error panel (not blank)
PASS  Retry loads the page once the server answers
PASS  crashed tab shows the crash panel  — This page stopped working
PASS  Retry after a crash reloads the page
PASS  Web Address… opens the prompt over the page
PASS  Cancel closes it and shows the tab again
PASS  chrome page can't navigate away  — bw-shell://chrome/index.html
PASS  web tabs can't load the chrome's bw-shell:// files  — blocked: Failed to fetch
PASS  menu: New Tab is bound to CmdOrCtrl+T  (… and Close Tab ⌘W, Open Location ⌘L, Back ⌘[, Forward ⌘],
      Reload ⌘R, Find ⌘F, Show Previous Tab ⇧⌘[, Show Next Tab ⇧⌘], Zoom In ⌘=, Zoom Out ⌘-, Actual Size ⌘0: 12 checks)
PASS  menu has the standard roles  — about,services,hide,hideothers,unhide,quit,undo,redo,cut,copy,paste,
      pasteandmatchstyle,delete,selectall,togglefullscreen,minimize,zoom,front
PASS  New Tab adds a tab and focuses the address bar
PASS  Close Tab removes it again
PASS  Open Location… focuses and selects the address bar
PASS  Show Next Tab moves right (wrapping)
PASS  Show Previous Tab moves back
PASS  Cmd+1 selects tab 1 / Cmd+2 selects tab 2 / Cmd+9 selects tab 3 (last)
PASS  Cmd+1 also works while a web page has focus
PASS  Zoom In zooms the page, not the chrome / Zoom Out / Actual Size resets zoom
PASS  Reload Page reloads the active tab
PASS  open tabs are saved for restore
PASS  window has a minimum size of 640×420  — [640,420]
PASS  Close Window closes the window, app keeps running
PASS  reopened window has the saved size and position  — {"x":60,"y":79,"width":1100,"height":720} → {"x":60,"y":79,"width":1100,"height":720}
PASS  reopening restores the same tabs  — ["https://blackwall.example.ts.net/","http://127.0.0.1:<port>/one","http://127.0.0.1:<port>/two"]
All checks passed
```

Earlier runs of the same script found five real bugs, all fixed before the final run:

- Favicons from http sites were blocked by the chrome's CSP. The main process now fetches them and passes `data:` URLs.
- Electron's `findInPage({ findNext })` works the opposite way from its name (`true` starts a new search), so the first search reported nothing.
- A background tab that hadn't loaded yet was labelled "New tab".
- Window close froze the app (see the deadlock below).
- A typo in the first-run copy.

### 3. `desktop:build` and the BUILT app

- Output: `packaging platform=darwin arch=arm64 electron=44.10.1`, `signing … identityName=-` (ad-hoc), `building target=DMG arch=arm64`. It produced `release/mac-arm64/Blackwall.app` (307 MB) and `release/Blackwall-0.1.0-arm64.dmg` (129 MB).
- `codesign --verify --deep`: "satisfies its Designated Requirement". The copy inside the dmg also passes `--strict`.
- `app.asar` has 21 entries: only `package.json` and `out/{main,preload,shared,chrome,icons}`, with no `node_modules`.
- Fuses (`@electron/fuses read`): RunAsNode Disabled, EnableNodeOptionsEnvironmentVariable Disabled, EnableNodeCliInspectArguments Disabled, EnableEmbeddedAsarIntegrityValidation Enabled, OnlyLoadAppFromAsar Enabled, GrantFileProtocolExtraPrivileges Disabled.

The built app was launched from `release/` with `--remote-debugging-port` so CDP could read its state. Results:

- **Fresh profile → first-run prompt:** `{"setup":true,"title":"Welcome — set your Blackwall address","tabs":["Blackwall"]}`.
- **Pinned tab loads the real hosted https site:** after the address was saved, CDP listed `page https://blackwall.example.ts.net/` and `service_worker https://blackwall.example.ts.net/sw.js`, and the address bar showed `{"addr":"https://blackwall.example.ts.net/","lock":"secure"}`.
- **Tabs and target=_blank:** after opening tabs through the chrome UI and clicking a `target=_blank` link, the strip showed `["Blackwall","Field notes, page 2","Example Domain","Field notes","Reading list *"]`. No new window was opened.
- **Unreachable address:** `{"errorPanel":true,"title":"Can’t reach this page","code":"ERR_CONNECTION_REFUSED (-102)","retry":"Retry"}`. After a server was started on that port, Retry gave `{"errorPanel":false,"tab":"Back up"}`.
- **Find in page:** `1 of 3`, then Enter gave `2 of 3`, and Escape closed the bar.
- **Sign-in persisting across a full quit and relaunch.** I don't have the production password, so this used the real Blackwall server code (`createApi` + `Sessions` + the built UI, file stores, a throwaway password) on `http://127.0.0.1:8799`, set as the pinned tab's Web Address.
  - Signing in through Blackwall's own login form: `/api/session` returned `{"authRequired":true,"authenticated":true}` and the page showed "Good evening".
  - The app was then quit with a normal macOS Quit Apple Event (`tell application … to quit`) and the process exited in 1 s.
  - **Relaunch 1:** tabs `["Blackwall","Field notes, page 2 *","Example Domain","Field notes","Back up"]`. Each tab came back on its last page (`/one-b`, `/productivity/planner`), the active tab was restored, and `{"authenticated":true}`.
  - Before quitting again I closed two tabs, made Blackwall active and moved it to `/learning`.
  - **Relaunch 2:** `["Blackwall *","Field notes, page 2","Field notes"]`, `{"authenticated":true,"path":"/learning","loginFormShown":false}`, and `SW controls page: http://127.0.0.1:8799/sw.js`.
- **Quit deadlock (found and fixed here):** the first built-app quit hung. The process stayed alive and CDP stopped answering. Reproduced in dev with event logging (`before-quit → will-quit`, then nothing): closing tab views' webContents after their window had been destroyed blocks Electron's main thread. Teardown now happens in the window's `close` event, and is skipped during quit. After the fix, quit exits in about 1 s and Close Window → Dock reopen works (verify checks above).

### 4. Screenshots

These are in `docs/design/reference/desktop-shell/`. Each is a `webContents.capturePage` of the chrome strip stitched onto a capture of the active tab, produced by `verify.ts`.

| File | Shows |
| --- | --- |
| `00-first-run.png` | First-run web-address prompt |
| `01-windowed-three-tabs.png` | Pinned Blackwall + two user tabs, user tab active, windowed |
| `02-windowed-pinned-active.png` | Same tabs, pinned tab (hosted Blackwall sign-in) active |
| `03-fullscreen-pinned-active.png` | Fullscreen, pinned active (no traffic-light inset) |
| `04-fullscreen-user-tab.png` | Fullscreen, user tab active |
| `05-find-in-page.png` | Find bar, "2 of 3" |
| `06-error-unreachable.png` | Unreachable address with Retry |
| `07-error-crash.png` | Crashed renderer with Retry |

`02` and `03` were redacted after capture: the address-bar text was repainted with `https://blackwall.example.ts.net/` (same font, size and colors as the chrome), because the original captures showed the real address. Nothing else in them was changed.

The native traffic lights aren't in these captures: capturePage only sees web content, and `screencapture` isn't permitted for this terminal.

## What doesn't work yet, or wasn't verified

- **Physical key presses weren't exercised.** macOS refused synthetic keystrokes from this terminal: `osascript is not allowed to send keystrokes (1002)`, because the terminal lacks the Accessibility permission. CDP key events don't reach the native menu. What *was* verified: every shortcut's menu binding, every menu action, Cmd+1–9 through `before-input-event` (from both the chrome and a web page), and the standard roles. To finish this check, grant your terminal app Accessibility (System Settings → Privacy & Security → Accessibility) and press the keys, or let me rerun with osascript.
- **Not exercised:** the confirmation dialog for app links (`obsidian://`, `mailto:`), the download save dialog, a real certificate error, and a real Dock click (Dock reopen was tested by emitting `activate`). Each one needs a native dialog or a click I couldn't drive.
- **Signing:** ad-hoc only, so Gatekeeper asks on first open of a downloaded copy (README explains how to open it). There's no notarization and no auto-update.
- **Cookie encryption fuse is off.** With an ad-hoc signature that changes on every build, the Keychain would prompt after each rebuild. Turn it on together with Developer ID signing.
- **Popups that need `window.opener`** (some OAuth flows) won't work, because they open as ordinary tabs by design.
- **All permissions are denied** except clipboard write, so sites can't show notifications or use the camera, location and so on. There are no history, bookmarks or extensions, and no tab drag-reordering.
- **Build location quirk:** inside the iCloud-synced Desktop folder, the copy in `release/` picks up File Provider attributes again. It still verifies and runs, but fails `codesign --strict`. The copy in the dmg is clean.
- **Not built:** the Native tab (the bundled Blackwall UI). Only macOS builds are set up.

## Decisions and why

1. **Electron 44.10.1 (pinned), not 45.** 45.0 came out on Oct 21, two weeks ago. 44 is the mature line and 44.10.1 is its latest security patch. electron-builder 26.18.0 (Oct 20) was the newest release more than a week old. No other dependencies were added. `@electron/fuses` and `@electron/asar` come with electron-builder.
2. **Docker build impact checked.** Electron 44 has no postinstall: it downloads its binary on first run. So the server image's `npm ci` doesn't fetch Electron, and the final image (`--omit=dev`) is unchanged. The build stage does install the extra devDependency packages. Their only install script is electron-winstaller's 7-Zip copy, which supports x64 and arm64. `npm run build` doesn't include the desktop tsconfig, so the Docker type-check doesn't need Electron's types. The `.dockerignore` was left alone so the build-tree hash still matches GitHub's tree for `blackwall-admin/`.
3. **Two-package layout.** `desktop/package.json` (no dependencies) is the app manifest. Electron and electron-builder stay in the web app's devDependencies, so there's one `npm install` and one lockfile. electron-builder then still fell back to collecting the parent's `node_modules` (react, pg, babel…) into `app.asar`, so `files` excludes `node_modules/**`. Verified: 21 entries.
4. **Build in a temp folder.** In the iCloud-synced Desktop folder, File Provider tags new files with attributes that `codesign` rejects ("resource fork, Finder information, or similar detritus not allowed"), and `xattr -cr` doesn't clear them for long. `desktop/scripts/build.ts` packages in a temp folder and `ditto`-copies the `.app` and `.dmg` into `release/`.
5. **Ad-hoc signature (`identity: "-"`), not none.** Apple silicon won't run code with no signature at all, and flipping fuses needs a re-sign.
6. **Chrome as the window's own page plus a `WebContentsView` per tab.** The chrome document fills the window, and tab views are laid over the area below it. While a full-page panel is shown (first run, Web Address…, a tab's error or crash), the view is hidden and the chrome draws the panel. Web content never renders the error page, so it can't fake or script it, and Retry goes through IPC.
7. **The chrome is served from a private `bw-shell://` scheme, not `file://`.** The handler is registered on the default session only, and tabs use `persist:blackwall-web`, so web pages can't load the chrome's files (verified: "Failed to fetch"). Path traversal is checked. The CSP is `default-src 'none'; script-src 'self'; img-src 'self' data:`. The `grantFileProtocolExtraPrivileges` fuse is off.
8. **IPC is only accepted from the chrome's main frame** at `bw-shell://chrome/`. Every message is shape-checked, and the preload hands listeners plain data (never the IPC event).
9. **Pinned tab stays on Blackwall.** Renderer navigations to another origin, and address-bar entries to another site, open a new tab. That keeps the Blackwall tab from being "lost" to an external link.
10. **Permissions:** denied, except `clipboard-sanitized-write`. That is the plain-text `navigator.clipboard.writeText`, which Chrome grants every page and Blackwall's Copy buttons rely on. Device, display-media and all other requests are denied.
11. **User agent:** the `Electron/…` and app tokens are removed for tabs, because some sites refuse or degrade for Electron user agents.
12. **Favicons are fetched by the main process** in the tab session (5 s timeout, 200 KB cap, image types only) and passed as `data:` URLs. This keeps the chrome page from loading anything from the web.
13. **Restore:** each tab's last URL and title are saved, not its back/forward history. Only the pinned tab and the active tab load at launch; the others load when first opened. The pinned tab restores its last page only if it's on the configured origin. The config is written atomically with mode 600, and the cookie store is flushed before quit.
14. **macOS conventions:** closing the window keeps the app in the Dock (clicking the Dock icon reopens it with the saved tabs). ⌘W on the pinned tab beeps instead of closing it. ⌘9 picks the last tab, as in Safari and Chrome.
15. **Dev profile is separate** (`Blackwall Dev`), so `desktop:dev` doesn't touch the built app's sign-in or tabs.
16. **Test-only code stays out of the app.** The only hook is an optional `userDataDir` option on `startShell`, used by `verify.ts`. The scripts aren't packaged.

After testing, I deleted the built app's profile (`~/Library/Application Support/Blackwall`), which pointed at the local test server. Your first launch will show the first-run prompt.
