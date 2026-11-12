// Node's test runner follows a shared file's location when resolving packages. Metro uses
// mobile/node_modules for these imports; make the tests do the same for Pagesmith's Markdown.
import { registerHooks } from "node:module"

const marked = import.meta.resolve("marked")
registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === "marked" ? nextResolve(marked, context) : nextResolve(specifier, context)
  },
})
