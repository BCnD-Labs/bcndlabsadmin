const { createHash } = require("node:crypto")
const { existsSync, readdirSync, readFileSync } = require("node:fs")
const path = require("node:path")

// Expo embeds this identity in the installed app; the publisher writes the same ID to android.json.
module.exports = ({ config }) => {
  const hash = createHash("sha256")
  function add(root) {
    if (!existsSync(root)) return
    for (const name of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(root, name.name)
      if (name.isDirectory() && !["build", ".gradle", "node_modules"].includes(name.name)) add(file)
      else if (name.isFile()) { hash.update(path.relative(__dirname, file)); hash.update(readFileSync(file)) }
    }
  }
  hash.update(readFileSync(path.join(__dirname, "app.json"))); hash.update(readFileSync(__filename)); hash.update(readFileSync(path.join(__dirname, "package-lock.json")))
  add(path.join(__dirname, "src")); add(path.join(__dirname, "assets")); add(path.join(__dirname, "modules")); add(path.join(__dirname, "..", "blackwall-admin", "shared"))
  const computed = hash.digest("hex")
  const stamped = process.env.BLACKWALL_ANDROID_UPDATE_ID
  return { ...config, extra: { ...config.extra, updateId: stamped && /^[a-f0-9]{64}$/.test(stamped) ? stamped : computed } }
}
