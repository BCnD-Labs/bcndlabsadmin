import assert from "node:assert/strict"
import { test } from "node:test"
import { windowSections, type SectionDestination } from "../src/mac/window-sections.ts"

const nav: SectionDestination[] = [
  { id: "home", label: "Home", match: "/" },
  { id: "productivity", label: "Productivity", match: "/productivity", children: [{ label: "Planner", to: "/productivity" }, { label: "Learning", to: "/productivity/learning" }] },
  { id: "cms", label: "Websites", match: "/cms", children: [{ label: "All sites", to: "/cms" }, { label: "Pages", to: "/cms/pages" }, { label: "Traffic", to: "/cms/analytics" }] },
  { id: "mikoshi", label: "Mikoshi", match: "/mikoshi", children: [{ label: "Launcher", to: "/mikoshi" }, { label: "Status", to: "/mikoshi/status" }, { label: "Storage", to: "/mikoshi/storage" }] },
]
// Which window each page opens in (as the desktop view maps paths).
const windowFor = (path: string) => path.startsWith("/mikoshi") ? "mikoshi" : path.startsWith("/cms") ? "website" : path.startsWith("/productivity/learning") ? "learning" : path.startsWith("/productivity") ? "planner" : "home"

test("Mikoshi's window lists Launcher, Status and Storage and marks the page you are on", () => {
  const s = windowSections(nav, windowFor, "mikoshi", "/mikoshi/storage?path=%2FClass")
  assert.deepEqual(s?.children.map((c) => c.label), ["Launcher", "Status", "Storage"])
  assert.equal(s?.current?.label, "Storage")
  assert.equal(windowSections(nav, windowFor, "mikoshi", "/mikoshi")?.current?.label, "Launcher")
  assert.equal(windowSections(nav, windowFor, "mikoshi", "/mikoshi/status")?.current?.label, "Status")
})

test("Websites gets its sub-pages too, and deeper pages keep their section marked", () => {
  assert.equal(windowSections(nav, windowFor, "website", "/cms/pages/abc")?.current?.label, "Pages")
  assert.equal(windowSections(nav, windowFor, "website", "/cms")?.current?.label, "All sites")
  assert.equal(windowSections(nav, windowFor, "website", "/cms/analytics")?.children.length, 3)
})

test("sections spread over several windows, and windows without sections, get no tabs", () => {
  assert.equal(windowSections(nav, windowFor, "learning", "/productivity/learning"), null)
  assert.equal(windowSections(nav, windowFor, "home", "/"), null)
  assert.equal(windowSections(nav, windowFor, "website", "/mikoshi"), null)
})
