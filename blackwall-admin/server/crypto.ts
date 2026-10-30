import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * AES-256-GCM for secrets at rest. The key comes from BLACKWALL_SECRET_KEY
 * (32 bytes, base64) and is never stored in the database, so a database dump
 * or backup alone doesn't reveal any tokens.
 */
export function loadKey(b64: string | undefined): Buffer {
  if (!b64) throw new Error("BLACKWALL_SECRET_KEY is not set. Generate one with: node server/cli.ts gen-key")
  const key = Buffer.from(b64, "base64")
  if (key.length !== 32) throw new Error("BLACKWALL_SECRET_KEY must be 32 bytes, base64-encoded")
  return key
}

export function seal(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`
}

export function unseal(key: Buffer, sealed: string): string {
  if (!sealed.startsWith("v1:")) throw new Error("Unknown secret format")
  const raw = Buffer.from(sealed.slice(3), "base64")
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")
}
