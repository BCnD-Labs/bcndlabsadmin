import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import type { IncomingMessage } from "node:http"

/**
 * Password hashes look like `scrypt.<N>.<r>.<p>.<salt>.<hash>` (base64url parts).
 * No `$` on purpose: shells and Docker Compose `.env` files would expand it.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const [N, r, p] = [32768, 8, 1]
  const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join(".")
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, N, r, p, salt, hash] = stored.trim().split(".")
  if (kind !== "scrypt" || !salt || !hash) return false
  const expected = Buffer.from(hash, "base64url")
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  })
  return timingSafeEqual(actual, expected)
}

const COOKIE = "bw_session"
const MAX_AGE_S = 30 * 24 * 3600

/** Stateless signed session cookie: `<expiry>.<hmac>`. */
export class Sessions {
  private readonly key: Buffer
  constructor(secretKey: Buffer) {
    // Separate key for signing, derived from the secrets key.
    this.key = createHmac("sha256", secretKey).update("blackwall-session-v1").digest()
  }

  private sign(payload: string) {
    return createHmac("sha256", this.key).update(payload).digest("base64url")
  }

  issue(secure: boolean): string {
    const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE_S)
    const value = `${exp}.${this.sign(exp)}`
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_S}${secure ? "; Secure" : ""}`
  }

  clear(secure: boolean): string {
    return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`
  }

  valid(req: IncomingMessage): boolean {
    const raw = (req.headers.cookie ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))
    if (!raw) return false
    const [exp, sig] = raw.slice(COOKIE.length + 1).split(".")
    if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false
    const expected = Buffer.from(this.sign(exp))
    const given = Buffer.from(sig)
    return expected.length === given.length && timingSafeEqual(expected, given)
  }
}

/** At most `limit` failed logins per client per window. */
export class LoginLimiter {
  private hits = new Map<string, number[]>()
  private readonly limit = 10
  private readonly windowMs = 15 * 60_000

  blocked(client: string): boolean {
    const now = Date.now()
    const recent = (this.hits.get(client) ?? []).filter((t) => now - t < this.windowMs)
    this.hits.set(client, recent)
    return recent.length >= this.limit
  }

  fail(client: string) {
    this.hits.set(client, [...(this.hits.get(client) ?? []), Date.now()])
  }
}
