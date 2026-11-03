# Blackwall for Android

An Expo app (managed workflow, TypeScript) whose main screen is a full-screen WebView of **your hosted Blackwall**. You can use the working web app as an app on your phone now, and native screens can be added later. It talks to the same server and data, with the same sign-in, as the browser. No server changes are needed.

This folder is its own project with its own `package.json` and lockfile. It isn't part of `blackwall-admin`'s typecheck, lint, build or Docker image.

## Setup

Requires Node 24 and npm.

```bash
cd mobile
npm ci            # exact versions from package-lock.json; no package in the tree has install scripts
npm run check     # typecheck + unit tests
npm run doctor    # expo-doctor (20 checks)
```

## Running it

- **On a phone or emulator with a development build:** `npm run android` (`expo run:android`). This needs the Android SDK and a JDK. It prebuilds `android/`, compiles and installs. `android/` is generated from `app.json` and is gitignored, so don't edit it.
- **Expo Go** (`npm start`, then scan the QR code) runs the JS. The small native "clear site data" module isn't in Expo Go, so there Clear site data does only the page-level cleanup (see below).

## First launch and changing the address

1. The first launch shows **Set your Blackwall address**. Type your server's https address, for example `https://blackwall.example.ts.net`. The app:
   - accepts https only, and adds `https://` to a bare host
   - normalizes the address to the site root (any path, query or `#…` is dropped, and the host is lowercased)
   - refuses `http://`, `javascript:`, `file:`, `data:` and every other scheme, credentials (`user:pw@`), non-ASCII hosts, bad ports and anything malformed
2. The address is stored **only on this phone**, in `expo-secure-store` (Android Keystore). App backup is turned off. It's never in the code, the config, an env file or the bundle.
3. Sign in on the Blackwall page itself. The app never sees or stores your password. Sign-in uses Blackwall's own cookie, which the WebView keeps across restarts. The **Remember me for 30 days** checkbox (PR #3) appears once the server has been redeployed with that change.
4. To change or clear the address, open **Settings** (see below) → **Server** → **Change address** / **Clear address**.

If the address can't be reached (Tailscale off, server down, a 5xx from the server, or nothing back within 30 s), the app shows **Can't reach Blackwall** with the reason, **Is Tailscale connected on this phone?**, **Retry** and **Change address**.

## Using it

- **Settings handle:** a small translucent tab on the right edge, with two grip lines. Tap it to open Settings. Drag it up or down either edge to move it out of the way; it snaps to the nearest side and remembers where you left it.
- **Back button:** goes back in Blackwall's page history, including in-app route changes. At the first page it leaves the app as usual.
- **Pull down to refresh** at the top of the page. It's turned off while a dialog is open or when you start the pull inside a list that's scrolled down, so a pull there never reloads the page.
- **Links:**
  - Links to your Blackwall stay in the app.
  - Links to any other website open in your default browser.
  - `mailto:`, `tel:`, `obsidian://` and similar ask before opening the other app.
  - `javascript:`, `file:`, `data:`, `blob:`, `content:`, `intent:` and malformed links are blocked.
  - `target=_blank` links and `window.open` follow the same rules.

## Settings

| Setting | What it does |
| --- | --- |
| Server → Change / Clear address | Edit the saved address (same validation as first launch), or clear it and go back to setup |
| View mode | **Web view** (default, working) or **Native** (visible, disabled: "Not built yet"). The choice is saved. |
| Page → Reload | Reloads the page |
| Page → Clear site data and sign out | Signs out (`/api/logout`), unregisters the service worker, and clears Cache Storage, local/session storage and IndexedDB from inside the page. Then the native module clears every WebView cookie and all web storage, the HTTP cache is cleared, and the app starts again at the sign-in page. Your server data isn't touched. Unsynced edits that exist only on this phone are lost. |
| About | App version and build number |

### View mode and native screens later

`App.tsx` renders the main area by view mode. `"web"` gives the WebView; `"native"` gives `NativeHome` from `src/native/index.ts`, which is `null` today. While it's `null`, Native stays disabled in Settings and a stored `"native"` falls back to the web view. To start native screens, export a component as `NativeHome` there and Native becomes selectable. The web view stays one tap away as the fallback.

## Building an APK

### Local Gradle build (no account needed)

Needs the Android SDK (`ANDROID_HOME`) and a JDK. Verified on this Mac with OpenJDK 26 and Gradle 9.4.1: the first build took about 7 minutes, later builds well under that.

```bash
cd mobile
npm ci
npx expo prebuild --platform android --clean
cd android
ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

The generated project signs the release APK with the **debug keystore**. That's fine for installing on your own phone, but not for the Play Store. For a real release, create your own keystore and keep it out of git (`*.keystore` / `*.jks` are gitignored).

### EAS Build (Expo's cloud; needs a free Expo account)

These are the exact commands. Nothing here has been run, and no account was created.

```bash
cd mobile
npx eas-cli@27.2.0 login                                    # your Expo account
npx eas-cli@27.2.0 init                                     # links the project; adds extra.eas.projectId to app.json
npx eas-cli@27.2.0 build --platform android --profile preview   # APK (eas.json "preview": buildType apk)
# Play Store bundle later: npx eas-cli@27.2.0 build --platform android --profile production
```

EAS gives you a download link (and a QR code) for the APK. On the phone, allow installing from that source when Android asks.

## Security model

- **Address:** device-only (SecureStore, no backup). No passwords are stored. There's no JS bridge except one fixed message (`bw:pull:1` / `bw:pull:0`, from your origin only) that turns pull-to-refresh on or off.
- **WebView:**
  - JavaScript and DOM storage are on, with persistent cookies; third-party cookies are off.
  - File access is off: `allowFileAccess`, `allowFileAccessFromFileURLs` and `allowUniversalAccessFromFileURLs` are all false.
  - Mixed content is never allowed, and geolocation is off.
  - `originWhitelist` is `["*"]` on purpose, so every navigation goes through the app's link check instead of being handed to Android unchecked.
- **Permissions:** the manifest requests only `INTERNET`. Camera, microphone, location, storage/media, overlay, vibrate and biometric are explicitly removed, so the page can't get them. Checked in the built APK with `aapt2 dump badging`.
- **Transport:** https only. Android blocks cleartext by default in release builds.

## Not done yet

- **No native Blackwall screens:** Native view mode is disabled.
- **Not run on a device or emulator yet.** The APK builds, but nothing has been installed or launched. See `docs/design/mobile-phase1-report.md` for exactly what was and wasn't verified, including the PWA/offline behaviour.
- **Downloads from the page:** Settings → Export makes a `blob:` download, which Android WebView doesn't hand to the download manager. Exporting from the app won't work, so use a browser for exports.
- **File uploads:** uploads (Media library, tile logos) use Android's file picker. Camera capture isn't offered because the camera permission is removed.
- **No push notifications, no app-icon badge, no share target, no deep links into specific pages.**
- **iOS isn't set up** (`platforms: ["android"]`).
