# Sign-in "remember me" and hostname scrub: report

Nov 2, 2026. Two pieces of work: (1) scrubbing the real server hostname from the unmerged `desktop-shell` branch (PR #2), and (2) a "Remember me for 30 days" option on sign-in (branch `signin-remember-me`, its own draft PR). Everything below was run on this Mac (Apple silicon, macOS 27.0.1, Node 24.15). The server address is always written as `blackwall.example.ts.net`.

## 1. Hostname scrub on `desktop-shell`

**Where the real hostname was:** the two desktop unit tests (`desktop/tests/config.test.ts`, `desktop/tests/url.test.ts`), seven places in `docs/design/desktop-phase1-report.md`, and the address bar of two screenshots (`02-windowed-pinned-active.png`, `03-fullscreen-pinned-active.png`). `desktop/scripts/verify.ts` never contained it (it takes the address as an argument and defaults to `https://example.com/`), and the other six screenshots only show `127.0.0.1` or the placeholder. The PR #2 description and its comments didn't contain it. Commit messages didn't either.

**What changed:**

- Tests and report: the hostname was replaced with `blackwall.example.ts.net`. The report now says the real address is written as the example throughout.
- The README example address `https://mikoshi.<tailnet>.ts.net` became `https://blackwall.example.ts.net`.
- Screenshots `02` and `03` were **redacted, not regenerated**. Regenerating would need a reachable https server at the example name, so instead the address-bar text was repainted with `https://blackwall.example.ts.net/` using a Chromium canvas inside Electron, in the chrome's own font (13px system font, `#c8cdd4` on `#1c1f25`). I looked at both results; nothing else in them changed. The report says so under Screenshots.

**History rewrite.** The repository is private (`gh repo view` → `{"visibility":"PRIVATE"}`), but the hostname was in 9 of the branch's 10 commits (in the test files from the second commit onward), so the branch was rewritten:

- `git reset --soft` to the merge base with `main` (`cfa0cab`), then recommitted the same final tree, plus the scrub, as six logical commits: scaffolding and build, main process and tests, chrome UI, verify script, README and screenshots, and the report.
- `git diff` between the old and new tips shows only the six scrubbed files.
- A check of every new commit (`git grep -a -i` over all blobs, including the PNGs, plus `git log -G` and `--grep`) found **0 hits**.
- `git push --force-with-lease=desktop-shell:09395fb… origin desktop-shell` → `+ 09395fb...ee9f9a5 desktop-shell -> desktop-shell (forced update)`. Only `desktop-shell` was force-pushed. The local backup branch was deleted afterwards.
- **One caveat:** GitHub can keep serving the old, now-unreferenced commits to anyone who already has their SHA, until it garbage-collects them. If that matters, GitHub Support can purge them on request.

**Checks after the scrub** (on the tree that was then committed):

- `npm run desktop:test`: `tests 7 · pass 7 · fail 0`
- `npm run check`: exit 0, `✓ built in 382ms`. The lint warnings are the pre-existing ones in `src/`.
- `node --test tests/*.test.ts`: `tests 31 · pass 30 · fail 0 · skipped 1`. The skipped test is the Postgres one, which needs `TEST_DATABASE_URL`.

## 2. "Remember me for 30 days" (`signin-remember-me`)

**Behaviour:**

| | Checkbox unchecked (default) | Checkbox checked |
| --- | --- | --- |
| Cookie | Browser-session: no `Max-Age`/`Expires`, so it goes away when the browser or app quits | Persistent, `Max-Age=2592000` (30 days) |
| Server-side expiry (signed into the cookie) | **12 hours** after sign-in | 30 days after sign-in |
| Attributes (both) | `HttpOnly; SameSite=Strict; Path=/`, plus `Secure` on non-loopback hosts (unchanged) | same |

**Defaults chosen for the unchecked case:** unchecked by default; 12 hours (`SESSION_S`) as the hard server-side limit, even if a browser restores session cookies; no sliding renewal (the session isn't extended while you use it). The server only treats `remember` as checked when the request body has exactly `true`. Anything else, including a missing field or the string `"true"`, gets the short session.

**Code:**

- `server/auth.ts`: `Sessions.issue(secure, remember = false)`. It exports `REMEMBER_S` (30 d) and `SESSION_S` (12 h). The cookie value is still `<expiry>.<hmac>` with the same derived key, so cookies issued before this change stay valid until their own 30 days run out. `valid()` is unchanged.
- `server/app.ts` (login route): reads `remember` from the body and passes `remember === true`.
- `src/services/connector.ts`: `login(password, remember?)` sends `{ password, remember }`.
- `src/components/layout/sign-in.tsx`: a "Remember me for 30 days" checkbox under the password field. The shadcn `Checkbox` is inside a `<label>`, so the whole 32px row is the tap target.
- `blackwall-admin/README.md`: a paragraph in "How credentials are handled".
- **Not touched:** password hashing, both login rate limits, `SameSite=Strict`, `Secure`, the Host check and the `X-Blackwall` rule. The new route test also confirms the `X-Blackwall` rule still returns 403 on login.

**Tests:** `tests/session.test.ts`, 5 tests:

- The cookie attributes for each case.
- The server-enforced expiry with mocked time: an unchecked session is valid at 11 h 59 m and rejected at 12 h 01 m, while the remembered one is still valid. A remembered session is valid at 30 d − 1 min and rejected at 30 d + 1 min.
- Old-format compatibility: a cookie signed with an independent re-creation of the old scheme validates, and a tampered or wrong-key cookie fails.
- The login route end to end: `remember: true` → `Max-Age=2592000`. Missing, `false` or `"true"` → no Max-Age, at most 12 h, and the cookie signs you in. A wrong password sets no cookie. A request without `X-Blackwall` gets 403.

**Real output:**

```text
npm run check → exit 0 · ✓ built in 1.99s (only the pre-existing lint warnings in src/)
node --test tests/*.test.ts
✔ remember me: 30-day persistent cookie with a 30-day signed expiry
✔ not remembered: browser-session cookie (no Max-Age/Expires) with a 12-hour signed expiry
✔ server enforces each expiry: 12 hours unchecked, 30 days checked
✔ cookie format unchanged: a cookie signed the old way still validates; tampering fails
✔ login route: `remember` in the body picks the cookie; only an explicit true remembers
ℹ tests 36 · pass 35 · fail 0 · skipped 1   (skipped: Postgres test, needs TEST_DATABASE_URL)
```

**End-to-end in a real browser engine.** The real server code (`createApi` + `Sessions` + file stores) served the built `dist/` on `127.0.0.1:8798` with a throwaway password. Electron 44 (Chromium) loaded it, filled in the real form and clicked Sign in, once unchecked and once checked, each in a fresh in-memory profile. The cookie jar showed:

```text
unchecked: {"session":true,"expirationDate":null,"httpOnly":true,"sameSite":"strict",
            "signedExpiry":"2026-11-03T14:38:49Z","now":"2026-11-03T02:38:51Z"}  /api/session → authenticated:true
checked:   {"session":false,"expirationDate":"2026-12-03T02:38:53Z","httpOnly":true,"sameSite":"strict",
            "signedExpiry":"2026-12-03T02:38:53Z","now":"2026-11-03T02:38:55Z"}  /api/session → authenticated:true
```

Screenshots: `docs/design/reference/signin/signin-remember-me.png` (unchecked, default) and `signin-remember-me-checked.png`.

**Not verified:**

- **Not deployed.** The server change needs a redeploy on Mikoshi before the checkbox appears there. Until then, the hosted server ignores `remember` and keeps issuing 30-day cookies. Nothing was deployed.
- I didn't verify that a real browser drops the session cookie on quit. That's browser behaviour: Chrome and Safari with "continue where you left off" or session restore may keep session cookies. The 12-hour server limit covers that case.
- In the Mac app (PR #2), an unchecked sign-in now ends when the app quits. Phase 1's "sign-in survives relaunch" result holds only when the box is checked. Not re-run against the desktop app.
- The Postgres test was skipped (no `TEST_DATABASE_URL`). This change doesn't touch storage.
- Real phone browsers and the installed PWA weren't tried.
