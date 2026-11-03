/**
 * Sign-in to the Blackwall server from the app. Pure functions plus an injectable fetch, so
 * they run under `node --test`.
 *
 * The contract is the server's (blackwall-admin/server/app.ts): every request carries
 * `X-Blackwall: 1`; `GET /api/session` answers `{authRequired, authenticated}`;
 * `POST /api/login` takes `{password, remember}` and sets the `bw_session` cookie (401 wrong
 * password, 429 too many attempts); `POST /api/logout` clears it. `credentials: "include"`
 * lets Android's shared cookie store keep that cookie for native fetch and the WebView alike.
 *
 * The password is only ever an argument here: it is not stored, logged, put in a URL or
 * echoed in any result.
 */

export type SessionStatus = "signed-in" | "signed-out" | "no-login-needed" | "unreachable"

export type SignInFailure = "wrong-password" | "too-many-attempts" | "unreachable" | "other"

export type SignInResult = { ok: true } | { ok: false; kind: SignInFailure; reason: string }

export type SignOutResult = { ok: true } | { ok: false; reason: string }

export const REQUEST_TIMEOUT_MS = 10_000

const UNREACHABLE = "Couldn't reach the server. Check the connection (is Tailscale on?) and try again."

function base(address: string): string {
  return address.replace(/\/+$/, "")
}

export function apiUrl(address: string, path: "session" | "login" | "logout"): string {
  return `${base(address)}/api/${path}`
}

/** One request with the headers the server needs and a timeout. Null when the server can't be reached. */
async function request(url: string, init: { method: "GET" | "POST"; body?: string }, fetchImpl: typeof fetch): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetchImpl(url, {
      method: init.method,
      body: init.body,
      signal: controller.signal,
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Blackwall": "1" },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Where this phone stands with the server right now. */
export async function sessionStatus(address: string, fetchImpl: typeof fetch = fetch): Promise<SessionStatus> {
  const res = await request(apiUrl(address, "session"), { method: "GET" }, fetchImpl)
  if (!res || !res.ok) return "unreachable"
  try {
    const body = (await res.json()) as { authRequired?: unknown; authenticated?: unknown }
    if (typeof body.authRequired !== "boolean" || typeof body.authenticated !== "boolean") return "unreachable"
    if (!body.authRequired) return "no-login-needed"
    return body.authenticated ? "signed-in" : "signed-out"
  } catch {
    return "unreachable"
  }
}

/** Sends the password once. `remember` asks for the 30-day cookie instead of the 12-hour one. */
export async function signIn(address: string, password: string, remember: boolean, fetchImpl: typeof fetch = fetch): Promise<SignInResult> {
  const res = await request(apiUrl(address, "login"), { method: "POST", body: JSON.stringify({ password, remember }) }, fetchImpl)
  if (!res) return { ok: false, kind: "unreachable", reason: UNREACHABLE }
  if (res.status === 401) return { ok: false, kind: "wrong-password", reason: "Wrong password." }
  if (res.status === 429) return { ok: false, kind: "too-many-attempts", reason: "Too many attempts. Try again in a few minutes." }
  if (res.status === 403) return { ok: false, kind: "other", reason: "The server refused the request. Check the address under Server." }
  if (!res.ok) return { ok: false, kind: res.status >= 500 ? "unreachable" : "other", reason: res.status >= 500 ? UNREACHABLE : `The server answered ${res.status}.` }
  try {
    const body = (await res.json()) as { authenticated?: unknown }
    if (body.authenticated === true) return { ok: true }
  } catch {
    // fall through
  }
  return { ok: false, kind: "other", reason: "The server's answer wasn't what Blackwall sends. Check the address under Server." }
}

/** Asks the server to end the session; its reply clears the cookie in the shared store. */
export async function signOut(address: string, fetchImpl: typeof fetch = fetch): Promise<SignOutResult> {
  const res = await request(apiUrl(address, "logout"), { method: "POST", body: "{}" }, fetchImpl)
  if (!res) return { ok: false, reason: UNREACHABLE }
  if (!res.ok) return { ok: false, reason: `The server answered ${res.status}.` }
  return { ok: true }
}

/** What Settings shows for each status. */
export function statusLabel(status: SessionStatus): { title: string; hint: string } {
  switch (status) {
    case "signed-in":
      return { title: "Signed in", hint: "Native screens are signed in. If the web view still asks for a password, sign out and sign in again." }
    case "signed-out":
      return { title: "Signed out", hint: "Enter your Blackwall password to sign in." }
    case "no-login-needed":
      return { title: "No sign-in needed", hint: "This server doesn't ask for a password." }
    case "unreachable":
      return { title: "Can't reach the server", hint: "Check the connection (is Tailscale on?), then check again." }
  }
}
