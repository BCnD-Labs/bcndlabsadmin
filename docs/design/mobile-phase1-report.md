# Android app, Phase 1: report

Branch `android-shell`, Nov 2, 2026. The Android equivalent of the Mac app's first job: an Expo app whose main screen is a full-screen WebView of your hosted Blackwall, with native setup and Settings and a view-mode toggle so the web view stays available once native screens exist. Run on this Mac (Apple silicon, macOS 27.0.1, Node 24.15, npm 11.12). The server address is written as `blackwall.example.ts.net` everywhere.

## Result

`mobile/` is a managed Expo project (SDK 58, React Native 0.88.1, TypeScript, Android only).

- First launch asks for the address and validates it.
- The main screen is the hosted Blackwall in `react-native-webview`, with strict link rules, back navigation, a guarded pull-to-refresh, an error screen with Retry and the Tailscale hint, and a small draggable handle that opens native Settings.
- Settings has address edit/clear, View mode (Web view / Native: disabled, "Not built yet"), Reload, Clear site data and sign out, and the version.

**Not run on a device or emulator.** There's no emulator on this Mac (details under Verification), so nothing here was observed on Android at runtime. A local Gradle build **did** produce an installable release APK (signed with the debug key), and its contents were inspected.

## What was built

| Area | Files |
| --- | --- |
| Entry, root, view-mode switch | `mobile/index.ts`, `mobile/App.tsx`, `mobile/src/native/index.ts` (`NativeHome = null`) |
| Address validation + link rules (pure, unit-tested) | `mobile/src/lib/url.ts` |
| Pull-to-refresh guard (the only page → app message) | `mobile/src/lib/bridge.ts` |
| View mode | `mobile/src/lib/view-mode.ts` |
| Device-only storage (SecureStore) | `mobile/src/lib/storage.ts` |
| Screens | `mobile/src/screens/SetupScreen.tsx`, `WebScreen.tsx`, `SettingsScreen.tsx` |
| Components | `mobile/src/components/AddressForm.tsx`, `ErrorView.tsx`, `SettingsHandle.tsx` |
| Local native module: clear WebView cookies + web storage | `mobile/modules/site-data/` (Kotlin, `expo-module.config.json`, `index.ts`) |
| Config | `mobile/app.json`, `mobile/eas.json`, `mobile/tsconfig.json`, `mobile/package.json` + lockfile, `.gitignore` |
| Assets | `mobile/assets/` (copied from `blackwall-admin/public/icons`) |
| Tests | `mobile/tests/url.test.ts` |
| Docs | `mobile/README.md`, root `README.md` (one line), this report |

Nothing in `blackwall-admin/` changed.

## Verification: what actually ran

### 1. Not part of blackwall-admin's tooling (B1)

- `blackwall-admin`'s `tsconfig.app.json` includes `src` and `shared`, and `tsconfig.node.json` includes `vite.config.ts`, `server` and `shared`.
- oxlint and Vite run inside `blackwall-admin/`, and the Docker build context is `blackwall-admin/` (`deploy/docker-compose.yml`: `context: ..` from `deploy/`).
- The repo root has no `package.json` and no CI workflows.
- After adding `mobile/` and merging the current `main`: `npm run check` in `blackwall-admin` exited 0 (`tsc -b && tsc -b desktop`, oxlint, `vite build`), with no mention of `mobile`. `node --test tests/*.test.ts` gave `tests 36 · pass 35 · fail 0 · skipped 1` (the skip is Postgres). `npm run desktop:test` gave `pass 7 · fail 0`.

### 2. Typecheck, unit tests, expo-doctor, audit

```text
npm run check   (tsc --noEmit && node --test tests/*.test.ts) → exit 0
✔ address: bare hosts get https://, everything normalizes to the origin root
✔ address: https only; dangerous schemes, credentials and malformed input are refused
✔ originOf: lowercases, strips default ports, rejects userinfo and junk
✔ links: your origin loads in the app, other web sites go to the browser
✔ links: app schemes ask first; script, file, intent and malformed URLs are blocked
✔ pull-to-refresh bridge: only the exact message, only from your origin
✔ view mode: web by default; native only once it exists
ℹ tests 7 · pass 7 · fail 0

npx expo-doctor → Running 20 checks on your project... 20/20 checks passed. No issues detected!
npm audit       → found 0 vulnerabilities
install scripts in the dependency tree (package-lock hasInstallScript) → none (486 packages)
```

The tests cover:

- **Addresses:** bare hosts; case; trailing dot; default and custom ports; IPv4/IPv6; path, query and hash dropped. Refused: `http:`, `javascript:` (any case), `file:`, `data:`, `content:`, `intent:`, `blob:`, `ftp:`, `ws:`, credentials, `\@` tricks, non-ASCII hosts, bad labels, bad ports and over-long input.
- **Links:** same origin → app; look-alike hosts (`blackwall.example.ts.net.evil.com`), other ports and an http downgrade → browser; `mailto:`, `tel:`, `obsidian:` → ask; script, file, data, blob, content, intent, about, chrome, view-source, userinfo, relative and control characters → block.
- **The bridge:** only exact messages from the configured origin are accepted.

First runs found and fixed:

- **expo-doctor:**
  - My `.gitignore` pattern `android/` would also have ignored `modules/site-data/android/`. It's now `/android/`.
  - SDK patch mismatches, and a duplicate `expo-constants` they caused, so I moved to the current SDK 58 patches.
- **`tsc`:** `react-native-webview` types `WebView<P = undefined>` with props `WebViewProps & P`, which is `never` under TypeScript 6. I worked around it with an instantiation expression (`RNWebView<{}>`) rather than loosening any prop.

### 3. JS bundle (Metro + Hermes)

`npx expo export --platform android` exited 0 and produced `index-….hbc (1.6MB)`, a Hermes bytecode bundle. Hermes compiles regex literals ahead of time, so the URL rules are valid on Hermes. `strings` on the bundle finds exactly one `*.ts.net` string, the placeholder `blackwall.example.ts.net`, and 0 occurrences of the real tailnet name.

### 4. Prebuild and native config

`npx expo prebuild --platform android --clean` exited 0, with no warnings once `expo-system-ui` was added. The generated `AndroidManifest.xml`:

- Requests only `android.permission.INTERNET`. Camera, record audio, all location, storage/media, overlay, modify-audio and vibrate are `tools:node="remove"`.
- Has `android:allowBackup="false"` and SecureStore's backup-exclusion rules.
- Has `enableOnBackInvokedCallback="false"`, so the back handler works.
- Has no `usesCleartextTraffic`.

The resolved config is `name Blackwall`, `package dev.bcndlabs.blackwall`, `versionCode 1`, `userInterfaceStyle dark`, `backgroundColor #1f2228`. Gradle wrapper: 9.4.1.

### 5. Local Gradle build (APK)

Ran in the generated `android/` with the existing SDK (`ANDROID_HOME=~/Library/Android/sdk`) and the only JDK on this Mac, **OpenJDK 26**. Gradle 9.4.1 (Kotlin 2.3.0) accepted it. The wrapper downloaded Gradle, and AGP fetched the rest of the build dependencies.

```text
./gradlew assembleRelease --no-daemon   (first run, from scratch)
BUILD SUCCESSFUL in 6m 58s
423 actionable tasks: 423 executed
> Task :site-data:compileReleaseKotlin        ← the local module compiled, no errors
```

The only warnings were deprecation warnings inside `react-native-webview`'s Kotlin (`receiveEvent` is deprecated) and manifest-merger notes that some removed permissions had nothing to remove.

**Rebuilt twice afterwards:** once for a fix found in review (the first mount reloaded the page twice), and once after the APK inspection below showed `USE_BIOMETRIC`/`USE_FINGERPRINT` arriving from `expo-secure-store`'s biometric library, which are now blocked too. Final build: `BUILD SUCCESSFUL in 3m 14s`.

**Inspection of the final APK** (`mobile/android/app/build/outputs/apk/release/app-release.apk`, 68 MB, gitignored), using the SDK's `aapt2`/`apksigner` 37.0.0:

```text
package: name='dev.bcndlabs.blackwall' versionCode='1' versionName='0.1.0'
minSdkVersion:'24'  targetSdkVersion:'36'
uses-permission: name='android.permission.INTERNET'
uses-permission: name='dev.bcndlabs.blackwall.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'   (AndroidX's internal, app-private)
native-code: 'arm64-v8a' 'armeabi-v7a' 'x86' 'x86_64'
V2 Signer: certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Verified using v2 scheme (APK Signature Scheme v2): true
sha256 50b5b4374bd0edda237faa53953a957091363cccfc065f983df2f196b2462e42
```

- The dex contains the `SiteData` module definition.
- `assets/index.android.bundle` contains one `*.ts.net` string, the `blackwall.example.ts.net` placeholder, and 0 occurrences of the real tailnet name. It also contains the "Is Tailscale connected on this phone?" hint.
- It's signed with the **debug keystore**: fine for sideloading onto your own phone (`adb install -r …` or copying the file over), not for the Play Store.
- **Not installed or launched anywhere.**

### 6. Emulator / device

- `~/Library/Android/sdk` has platforms 35/36/36.1, build-tools, NDK 29/30, platform-tools and the emulator binary.
- But it has **no system images** (`system-images/` doesn't exist), and `emulator -list-avds` printed nothing.
- There's no `cmdline-tools`/`sdkmanager` to create one, and `adb devices` listed no devices.
- As instructed, I didn't download a system image or create an AVD. **Nothing was run on Android.**

### 7. PWA inside Android WebView (B5)

**Not observed, because no device or emulator was available. I'm not claiming it works.** What the code says, so you know what to look for:

- The web app registers `/sw.js` only when `import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext`. Over https in the WebView, all three should hold. Android System WebView supports service workers, but that's untested here.
- An offline start can only work after one successful online load. `sw.js` caches `/` from a navigation and serves it when the network fails, and `/assets/*` are cache-first. `/api/*` is never cached, so offline you'd see the cached shell and the browser-cached workspace, with server saves failing.
- How the app behaves:
  - If the service worker answers offline, the WebView loads normally, with no error screen.
  - If it doesn't (first launch, cleared data, unsupported), Android reports `ERR_INTERNET_DISCONNECTED` or `ERR_NAME_NOT_RESOLVED`, and the app shows **Can't reach Blackwall** with Retry and the Tailscale hint.
- **Clear site data** unregisters the service worker and deletes Cache Storage, so the next offline start won't work until you've loaded the page online again.
- To check on a phone: install, load Blackwall once with Tailscale on, force-stop, turn Tailscale off, and open the app. Then, in Chrome on a desktop, `chrome://inspect` → the WebView (debug builds only, `webviewDebuggingEnabled={__DEV__}`) → Application → Service Workers.

## What doesn't work, or wasn't verified

- **Everything at runtime on Android:**
  - layout, safe areas and status bar
  - keyboard padding (see decision 9)
  - the handle drag
  - back-button history, including SPA route changes
  - pull-to-refresh and its guard
  - link routing in practice, including the `onOpenWindow` path
  - cookie persistence across app restarts
  - Clear site data, the native module and `WebStorage.deleteAllData()` coverage of service workers and IndexedDB
  - the 30-second timeout and the 5xx error path

  All of these are written against the library and Android APIs, but none were exercised.
- **The PWA/offline behaviour** (section 7).
- **The remember-me checkbox** needs the server redeploy from PR #3 before it shows up in the app.
- **Known limitations:**
  - `blob:` downloads (Settings → Export) aren't handed to Android's download manager, so exporting from the app won't work.
  - Camera capture isn't offered for uploads, because the permission is removed. The file picker still works in principle (untested).
  - There's no iOS build, no push notifications and no deep links.
  - The release APK from a plain prebuild is signed with the debug keystore.
- **Settings handle and the system back gesture:** the handle sits on a screen edge, where Android's gesture navigation listens for back swipes. Taps and vertical drags should reach it, but a horizontal swipe starting on it may trigger back instead.

## Dependencies added (all in `mobile/`, pinned exactly, lockfile committed)

Checked for each:

- npm registry metadata (`npm view`) and the source repo
- maintainers and weekly downloads (api.npmjs.org)
- publish date and license
- install scripts: `scripts.{pre,post,}install`, plus `hasInstallScript` across the whole lockfile, which found none in all 486 packages
- `npm audit`
- typosquat check: every name matches the official package exactly

No GPL/AGPL/unlicensed packages.

| Package | Version | Why | Checked → result |
| --- | --- | --- | --- |
| expo | 58.0.22 | Expo SDK (required) | expo/expo, Expo team, ~15.8M/wk, Oct 31, MIT, no install scripts ✔ |
| react | 19.3.0 | SDK 58's React | react/react, Meta, ~244M/wk, Sep 9, MIT ✔ |
| react-native | 0.88.1 | SDK 58's RN | react/react-native, Meta, ~20.5M/wk, Oct 27, MIT ✔ |
| react-native-webview | 14.0.1 | The WebView | react-native-webview org (community), ~7.8M/wk, Jun 20, MIT. `prepare` script only (runs for git checkouts, not registry installs) ✔ |
| expo-secure-store | 58.0.2 | Device-only address storage | expo/expo, ~10.1M/wk, Oct 1, MIT ✔ |
| expo-constants | 58.0.14 | App version in Settings | expo/expo, ~16.8M/wk, Oct 28, MIT ✔ |
| expo-status-bar | 58.0.4 | Light status bar | expo/expo, ~12.0M/wk, Oct 21, MIT ✔ |
| expo-splash-screen | 58.0.12 | Dark splash (config plugin) | expo/expo, ~9.8M/wk, Oct 28, MIT ✔ |
| expo-system-ui | 58.0.7 | `userInterfaceStyle: dark` and root background on Android | expo/expo, ~7.1M/wk, Oct 28, MIT ✔ |
| react-native-safe-area-context | 5.10.1 | Safe areas | appandflow (maintainer of the original), ~15.2M/wk, Sep 29, MIT. `prepare` only ✔ |
| typescript (dev) | 6.0.3 | Typecheck | microsoft/TypeScript, ~401M/wk, Apr 16, Apache-2.0 ✔ |
| @types/react (dev) | 19.3.0 | Types | DefinitelyTyped, ~217M/wk, Sep 9, MIT ✔ |
| expo-doctor (dev) | 1.21.5 | Project health check | expo/expo, ~1.8M/wk, Oct 16, MIT ✔ |

**Overrides (security fixes).** The first install's `npm audit` reported 12 moderate findings from two advisories published Oct 30:

- GHSA-3g3m-2fjr-6pw4: glob ≤14.0.1
- GHSA-g3hv-75wg-m249: minimatch <11.0.1

Both are reached only through Expo's build-time CLI and config tooling, not the app bundle. npm's "fix" was a downgrade to Expo 51, so instead `package.json` `overrides` pins the patched releases:

| Override | Version | Checked → result |
| --- | --- | --- |
| glob | 14.0.2 | isaacs/node-glob, sole maintainer isaacs, ~536M/wk, Oct 27, BlueOak-1.0.0 (permissive), no install scripts ✔ |
| minimatch | 11.0.1 | isaacs/minimatch, isaacs, ~949M/wk, Oct 27, BlueOak-1.0.0, no install scripts ✔ |
| @isaacs/nonrecursive-glob-match | 1.0.3 | New dependency of minimatch 11. Repo isaacs/nonrecursive-glob-match (created Mar 2026, on minimatch's own HEAD), maintainer isaacs, ~1.9M/wk, BlueOak-1.0.0, no install scripts. **Flag: first published Oct 26 (young), and npm metadata has no `repository` field.** I confirmed the repo on GitHub instead. ✔ with that note |

After the overrides: `npm audit` → 0 vulnerabilities. expo-doctor 20/20, `expo export`, `expo prebuild` and the Gradle build all ran with them, so Expo's tooling works on the newer majors. Remove the overrides once Expo ships glob 14 and minimatch 11 itself.

**Referenced but not installed:** `eas-cli@27.2.0` in the README's EAS commands (expo/expo, ~2.1M/wk, Oct 29, MIT, no postinstall). It wasn't run, and no account was created.

**Downloaded by the local build:** the Gradle 9.4.1 distribution (services.gradle.org, via the generated wrapper) and the Android/Maven build dependencies from Google's Maven and Maven Central. These are standard for any Android build. No `curl | sh` or other scripts were run.

## Decisions and why

1. **Expo SDK 58, latest patches.** 58.0.0 shipped Sep 29, and 57 is the previous line. I first pinned a patch more than a week old (58.0.19), as in Phase 1, but expo-doctor flagged patch mismatches and a resulting duplicate native module. Expo's guidance is to track the SDK's current patches, so it's now 58.0.22 with the versions that release's compatibility table names.
2. **Package id `dev.bcndlabs.blackwall`.** As requested. I found no reason not to: it's a reverse-DNS name for a domain the org uses, and it's unique enough. Note: it can't change after a Play Store release.
3. **Managed workflow with a gitignored `android/`.** `app.json` is the source of truth, and prebuild regenerates the native project. The one piece of native code, the site-data module, lives in `modules/` and is autolinked, so prebuild never overwrites it.
4. **No navigation library.** There are three screens: setup, main, and Settings as a modal. State plus RN's `Modal` and `BackHandler` cover them. A native home later slots in at `App.tsx` behind the view-mode switch (`NativeHome` in `src/native/index.ts`).
5. **Own URL parser instead of `URL`.** React Native's `URL` has historically been incomplete, and the same rules have to behave identically under `node --test` and Hermes.
6. **`originWhitelist={["*"]}`.** In 14.0.1, URLs outside the whitelist are passed straight to `Linking.openURL` without calling `onShouldStartLoadWithRequest`, which would let `intent:` and other schemes through unchecked. With `*`, every navigation hits the app's rules. `target=_blank`/`window.open` (`setSupportMultipleWindows` + `onOpenWindow`) use the same rules. In-app ones open in place, because there's no second WebView.
7. **Pull-to-refresh is guarded.** `pullToRefreshEnabled` is iOS-only in 14.0.1, so Android uses a `RefreshControl`. A plain one would reload whenever the page is at the top, including while you scroll a dialog or a list, which loses work. A small injected script reports on each touchstart whether a refresh is allowed (page at top, nothing scrolled under the finger, no `aria-modal`/open dialog). It's the only message the app accepts: two fixed strings, from your origin only.
8. **Settings opener: a draggable edge tab.** Android's back gesture owns both screen edges, long-press belongs to text selection, pulling down from the top opens the notification shade, and pulling down on the page is now pull-to-refresh. A small translucent tab can be seen, is a 44 px tap target, never covers the web app's header, and can be dragged anywhere along either edge. It remembers its position.
9. **Keyboard.** Edge-to-edge Android doesn't resize the window for the IME, so the WebView container gets bottom padding equal to the keyboard height (`keyboardDidShow`). Unverified on device. If inputs end up double-shifted on some Android version, this is the place to look.
10. **Errors.** A main-frame network error, a main-document 5xx from your origin, a renderer crash, or no first load within 30 s shows **Can't reach Blackwall** (or a specific title), the reason, **Is Tailscale connected on this phone?**, Retry and Change address. Retry remounts the WebView at the last URL.
11. **Clear site data does three things.**
    - The page logs out via `/api/logout`, unregisters its service worker, and deletes caches, local/session storage and IndexedDB.
    - A tiny local Kotlin module clears all WebView cookies (including the HttpOnly session cookie, which page JS can't touch) and calls `WebStorage.deleteAllData()`.
    - `clearCache(true)` clears the HTTP cache, and the WebView restarts.

    I wrote a 30-line local module instead of adding a cookie library, because the candidates aren't actively maintained. In Expo Go the module is absent (`requireOptionalNativeModule`), and only the page-level steps run.
12. **Storage.** The address, view mode and handle position are in `expo-secure-store` (Keystore-backed), with `allowBackup: false`, so the address never leaves the phone. The address is re-validated on every read.
13. **Permissions.** `permissions: []` plus an explicit `blockedPermissions` list, so libraries can't add camera, mic, location, media, overlay, vibrate or biometric permissions. In the built APK, only INTERNET remains (plus AndroidX's app-private receiver permission). Geolocation is off in the WebView, and mixed content is `never`.
14. **Theme.** Dim tokens from `theme.css`: ground `#1f2228`, the light-red error text `#ffa8a8`, and red actions. The status bar is light on the ground color, which matches the web app's static `theme-color`. The adaptive icon is the maskable icon on the brand red, whose glyph sits inside Android's safe zone.
15. **Tests run with Node's type stripping (`node --test`), with no Jest.** The pure modules have no React Native imports. Test files stay out of `tsc` to avoid adding `@types/node`.
16. **`git merge main`.** Done on request before finishing. `main` had gained PR #2 and PR #3, so this branch now includes them (a fast-forward, since nothing was committed yet). The web app's checks were re-run after it.
