import assert from "node:assert/strict"
import { test } from "node:test"
import { accentVars, cleanHex, cleanRoundness, cleanTheme, luminance, THEMES } from "../src/lib/look.ts"

test("themes: unknown values fall back, every theme is unique", () => {
  assert.equal(cleanTheme("midnight", "dim"), "midnight")
  assert.equal(cleanTheme("neon", "graphite"), "graphite")
  assert.equal(new Set(THEMES.map((t) => t.value)).size, THEMES.length)
  assert.equal(cleanRoundness("round"), "round")
  assert.equal(cleanRoundness("blob"), "default")
})

test("hex colours are cleaned, and a light accent gets dark text", () => {
  assert.equal(cleanHex("#ABC"), "#aabbcc")
  assert.equal(cleanHex("3b78e7"), "#3b78e7")
  assert.equal(cleanHex("red"), "")
  assert.equal(cleanHex(5), "")
  assert.ok(luminance("#ffffff") > 0.99 && luminance("#000000") < 0.01)
  assert.equal(accentVars("#3b78e7").on, "#ffffff")
  assert.equal(accentVars("#ffe066").on, "#14171c")
  assert.match(accentVars("#3b78e7").soft, /^rgba\(59, 120, 231, 0\.15\)$/)
  assert.ok(luminance(accentVars("#3b78e7").hover) < luminance("#3b78e7"))
})
