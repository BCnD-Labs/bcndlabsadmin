import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"
import { hashPassword } from "./auth.ts"
import { loadKey } from "./crypto.ts"
import { PostgresConnectionStore } from "./store-postgres.ts"
import type { StoredConnection } from "./store.ts"

/**
 * Setup helpers. Run with Node 24+ (it runs TypeScript directly):
 *   node server/cli.ts gen-key            → value for BLACKWALL_SECRET_KEY
 *   node server/cli.ts hash-password      → value for BLACKWALL_PASSWORD_HASH (prompts)
 *   node server/cli.ts import <file.json> → copy dev connections into Postgres
 *                                            (needs DATABASE_URL and BLACKWALL_SECRET_KEY)
 */
const [cmd, arg] = process.argv.slice(2)

if (cmd === "gen-key") {
  console.log(randomBytes(32).toString("base64"))
} else if (cmd === "hash-password") {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const pw = arg ?? (await rl.question("Password: "))
  rl.close()
  if (pw.length < 12) {
    console.error("Use at least 12 characters.")
    process.exit(1)
  }
  console.log(hashPassword(pw))
} else if (cmd === "import" && arg) {
  const { connections } = JSON.parse(readFileSync(arg, "utf8")) as { connections: StoredConnection[] }
  const store = new PostgresConnectionStore(process.env.DATABASE_URL ?? "", loadKey(process.env.BLACKWALL_SECRET_KEY))
  await store.migrate()
  for (const c of connections) {
    const created = await store.create({ provider: c.provider, label: c.label, config: c.config, secrets: c.secrets })
    console.log(`imported ${c.label} → ${created.id}`)
  }
  await store.close()
} else {
  console.log("Usage: node server/cli.ts gen-key | hash-password | import <connections.json>")
  process.exit(cmd ? 1 : 0)
}
