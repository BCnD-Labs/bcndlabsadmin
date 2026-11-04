import assert from "node:assert/strict"
import { test } from "node:test"
import { MAX_OPEN_TOOLS, addressLabel, closeTool, groupServices, noTools, openTool, pruneTools, showList, statusSummary, toolTarget } from "../src/native/screens/mikoshi/mikoshi-rules.ts"

const svc = (id: string, name: string, group: string, pinned = false) => ({ id, name, group, pinned, url: `https://${id}.example.ts.net/`, description: "" })

test("services group in the web launcher's order, then alphabetically, pinned first inside a group", () => {
  const groups = groupServices([svc("a", "Zed", "Apps"), svc("b", "Portainer", "Infrastructure"), svc("c", "Beta", "Apps", true), svc("d", "Alpha", "Apps"), svc("e", "Odd", "Zebra"), svc("f", "Plain", "  ")])
  assert.deepEqual(groups.map((g) => g.group), ["Infrastructure", "Apps", "Other", "Zebra"])
  assert.deepEqual(groups[1].items.map((i) => i.name), ["Beta", "Alpha", "Zed"])
})

test("https tools open in the app, plain http only in the browser, anything else is invalid", () => {
  assert.deepEqual(toolTarget("https://mikoshi.example.ts.net:9443/x"), { kind: "app", url: "https://mikoshi.example.ts.net:9443/x", origin: "https://mikoshi.example.ts.net:9443" })
  assert.deepEqual(toolTarget("http://mikoshi:9090"), { kind: "browser", url: "http://mikoshi:9090" })
  for (const bad of ["", "mikoshi", "javascript:alert(1)", "ftp://x.y", "https://exa mple.com"]) assert.equal(toolTarget(bad).kind, "invalid", bad)
})

test("the address label shows the port when there is one, otherwise the host", () => {
  assert.equal(addressLabel("https://mikoshi.example.ts.net:9443/path"), ":9443")
  assert.equal(addressLabel("https://n8n.mikoshi.example.ts.net/"), "n8n.mikoshi.example.ts.net")
  assert.equal(addressLabel("not a url"), "not a url")
})

test("opening a tool makes it the most recent and the active one; reopening does not duplicate it", () => {
  let t = openTool(noTools, "a")
  t = openTool(t, "b")
  t = openTool(t, "a")
  assert.deepEqual(t, { open: ["b", "a"], active: "a" })
})

test("only a few tools stay loaded: the least recently used one is dropped", () => {
  let t = noTools
  for (const id of ["a", "b", "c", "d", "e"]) t = openTool(t, id)
  assert.equal(t.open.length, MAX_OPEN_TOOLS)
  assert.deepEqual(t.open, ["b", "c", "d", "e"])
  assert.equal(t.active, "e")
})

test("closing the tool on screen goes to the most recent other tool, then to the list; closing another keeps the view", () => {
  let t = openTool(openTool(openTool(noTools, "a"), "b"), "c")
  assert.deepEqual(closeTool(t, "a"), { open: ["b", "c"], active: "c" })
  t = closeTool(t, "c")
  assert.deepEqual(t, { open: ["a", "b"], active: "b" })
  t = closeTool(closeTool(t, "b"), "a")
  assert.deepEqual(t, noTools)
})

test("back to the list keeps every open tool", () => {
  assert.deepEqual(showList(openTool(openTool(noTools, "a"), "b")), { open: ["a", "b"], active: null })
})

test("a tool whose service was deleted is forgotten", () => {
  const t = openTool(openTool(noTools, "a"), "b")
  assert.equal(pruneTools(t, new Set(["a", "b"])), t)
  assert.deepEqual(pruneTools(t, new Set(["a"])), { open: ["a"], active: null })
})

test("the status summary counts up, down and unchecked tools once per address", () => {
  const by = new Map([["u1", { url: "u1", up: true }], ["u2", { url: "u2", up: false }]])
  assert.deepEqual(statusSummary(["u1", "u2", "u3", "u1"], by), { up: 1, down: 1, unchecked: 1 })
})
