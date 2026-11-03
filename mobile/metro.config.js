// Metro config: lets the app import the TypeScript in ../blackwall-admin/shared (and the
// type-only file it references) so native and web share one set of rules.
const path = require("node:path")
const { getDefaultConfig } = require("expo/metro-config")

const projectRoot = __dirname
const adminRoot = path.resolve(projectRoot, "../blackwall-admin")

const config = getDefaultConfig(projectRoot)

config.watchFolders = [...(config.watchFolders ?? []), path.join(adminRoot, "shared"), path.join(adminRoot, "src", "lib")]
// Packages are always resolved from mobile/node_modules, never from blackwall-admin/.
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")]

module.exports = config
