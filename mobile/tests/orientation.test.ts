import assert from "node:assert/strict"
import { test } from "node:test"
import { DESTINATIONS } from "../src/native/nav/destinations.ts"
import { layoutMode, pageWidth, sidebarSections, SIDEBAR_WIDTH } from "../src/native/nav/orientation.ts"

test("wider than tall is landscape, and the sidebar takes its share of the width", () => {
  assert.equal(layoutMode(412, 915), "portrait"); assert.equal(layoutMode(915, 412), "landscape"); assert.equal(layoutMode(800, 800), "portrait")
  assert.equal(pageWidth(915, "landscape"), 915 - SIDEBAR_WIDTH); assert.equal(pageWidth(412, "portrait"), 412)
})

test("the sidebar lists every destination once, with the main four first", () => {
  const sections = sidebarSections()
  assert.deepEqual(sections.map((s) => s.group), [null, "Daily", "Build", "Homelab"])
  assert.deepEqual(sections[0].items.map((d) => d.key), ["home", "planner", "learning", "journal"])
  assert.deepEqual(sections.flatMap((s) => s.items.map((d) => d.key)).sort(), DESTINATIONS.map((d) => d.key).sort())
})
