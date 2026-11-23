/** Lets Node load app modules written with the "@/" and "@shared/" shortcuts and extensionless imports (tests only). */
import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const map = [["@/", path.join(root, "src")], ["@shared/", path.join(root, "shared")]]
const isFile = (p) => existsSync(p) && statSync(p).isFile()
const find = (base) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")].find(isFile)

export async function resolve(specifier, context, next) {
  for (const [prefix, dir] of map) {
    if (!specifier.startsWith(prefix)) continue
    const found = find(path.join(dir, specifier.slice(prefix.length)))
    if (found) return next(pathToFileURL(found).href, context)
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file://") && !/\.[a-z]+$/.test(specifier)) {
    const found = find(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier))
    if (found) return next(pathToFileURL(found).href, context)
  }
  return next(specifier, context)
}
