import assert from "node:assert/strict"
import { test } from "node:test"
import * as routes from "../src/lib/routes.ts"
import { appForPath } from "../src/mac/app-for-path.ts"

test("every section has its own window in the Mac desktop workspace", () => {
  // Insights is a tab of the Home window; every other section must not fall back to it.
  const homePages: string[] = [routes.insightsHref]
  for (const [name, path] of Object.entries(routes)) {
    if (typeof path !== "string" || homePages.includes(path)) continue
    assert.notEqual(appForPath(path.split(/[?#]/)[0]), "home", `${name} (${path}) has no Mac window: see src/mac/app-for-path.ts`)
  }
  assert.equal(appForPath(routes.mailHref), "mail")
})
