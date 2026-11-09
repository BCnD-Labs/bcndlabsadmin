import assert from "node:assert/strict"
import { test } from "node:test"
import { aspectCrop, assetPath, assetUsage, clampRect, fitInside, humanBytes, imagePathsIn, imagePathsInPost, libraryFileName, outputSize, sizeChange, usedAssets } from "../shared/assets.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import type { Asset, Draft, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-09T00:00:00Z"
const asset = (id: string, file: string): Asset => ({ id, name: file, file, folder: "/Blackwall/assets", mime: "image/webp", width: 800, height: 600, bytes: 40_000, alt: "", createdAt: ts, updatedAt: ts })
const page = (sections: SitePage["sections"]): SitePage => ({ id: "p", siteId: "s", title: "P", slug: "p", description: "", inMenu: true, order: 0, sections, createdAt: ts, updatedAt: ts })
const post = (patch: Partial<Draft>): Draft => ({ id: "d", title: "T", slug: "t", kind: "post", status: "ready", excerpt: "", body: "", siteId: "s", createdAt: ts, updatedAt: ts, ...patch })

test("sizes shrink to fit a box but are never enlarged, and keep their shape", () => {
  assert.deepEqual(fitInside(4000, 3000, 1600), { width: 1600, height: 1200 })
  assert.deepEqual(fitInside(800, 600, 1600), { width: 800, height: 600 })
  assert.deepEqual(fitInside(1000, 3000, 1500, 1500), { width: 500, height: 1500 })
})

test("a crop of a given shape is the biggest one that fits, centered or around a chosen point", () => {
  assert.deepEqual(aspectCrop(4000, 3000, 16 / 9), { x: 0, y: 375, width: 4000, height: 2250 })
  assert.deepEqual(aspectCrop(4000, 3000, 1), { x: 500, y: 0, width: 3000, height: 3000 })
  assert.deepEqual(aspectCrop(4000, 3000, 1, { x: 0, y: 0 }), { x: 0, y: 0, width: 3000, height: 3000 })
  assert.deepEqual(clampRect({ x: -50, y: 2900, width: 5000, height: 400 }, 4000, 3000), { x: 0, y: 2600, width: 4000, height: 400 })
})

test("output size follows one side or the longest edge, and only enlarges when asked", () => {
  assert.deepEqual(outputSize({ width: 3000, height: 2000 }, { width: 1200 }), { width: 1200, height: 800 })
  assert.deepEqual(outputSize({ width: 3000, height: 2000 }, { longest: 600 }), { width: 600, height: 400 })
  assert.deepEqual(outputSize({ width: 800, height: 600 }, { width: 2000 }), { width: 800, height: 600 })
  assert.deepEqual(outputSize({ width: 800, height: 600 }, { width: 1600 }, true), { width: 1600, height: 1200 })
  assert.deepEqual(outputSize({ width: 800, height: 600 }, { width: 300, height: 300 }), { width: 300, height: 300 })
})

test("file names are tidy and never collide with ones already in the library", () => {
  const taken = new Set(["team-photo.webp"])
  assert.equal(libraryFileName("Team Photo!!.JPG", "webp", taken), "team-photo-2.webp")
  assert.equal(libraryFileName("Café ☕ menu", "jpg", taken), "cafe-menu.jpg")
  assert.equal(libraryFileName("***", "png", taken), "picture.png")
  assert.equal(humanBytes(900), "900 B")
  assert.equal(humanBytes(3_400_000), "3.2 MB")
  assert.equal(sizeChange(3_000_000, 90_000), "97% smaller")
  assert.equal(sizeChange(100, 101), "about the same size")
})

test("the pictures a page, a post and a built site use are found through blocks, covers and Markdown", () => {
  const a = asset("a", "team.webp"), b = asset("b", "cover.webp"), c = asset("c", "unused.webp"), d = asset("d", "draft-only.webp")
  const blocks = [{ id: "1", type: "section", kids: [{ id: "2", type: "row", kids: [{ id: "3", type: "image", src: "/images/team.webp" }] }] }]
  assert.deepEqual(imagePathsIn(blocks), ["/images/team.webp"])
  const live = post({ cover: assetPath(b), body: "Hello ![x](/images/team.webp) and ![](https://elsewhere/y.png)", publishedAt: ts })
  assert.deepEqual(imagePathsInPost(live), ["/images/cover.webp", "/images/team.webp"])
  const draft = post({ id: "d2", body: "![z](/images/draft-only.webp)" })
  assert.deepEqual(usedAssets([a, b, c, d], "s", [page(blocks)], [live, draft]).map((x) => x.id), ["a", "b"])
  const use = assetUsage(a, [page(blocks)], [live, draft])
  assert.equal(use.pages.length, 1)
  assert.equal(use.posts.length, 1)
})

test("an older workspace has no assets and still loads; one with assets loads and bad rows are refused", () => {
  const old = emptyWorkspace() as unknown as Record<string, unknown>
  delete old.assets
  assert.ok(validWorkspace(old))
  assert.deepEqual((old as { assets: unknown[] }).assets, [])
  assert.ok(validWorkspace({ ...emptyWorkspace(), assets: [asset("a", "team.webp")] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), assets: [{ ...asset("a", "team.webp"), file: "../secret.png" }] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), assets: [{ ...asset("a", "team.webp"), width: "wide" }] }))
})

import { dragRect } from "../shared/assets.ts"
test("dragging a crop moves it, resizes it, keeps it inside the picture, and keeps its shape when locked", () => {
  const bounds = { width: 1000, height: 800 }
  const r = { x: 100, y: 100, width: 400, height: 300 }
  assert.deepEqual(dragRect(r, "move", 50, -500, bounds), { x: 150, y: 0, width: 400, height: 300 })
  assert.deepEqual(dragRect(r, "move", 5000, 5000, bounds), { x: 600, y: 500, width: 400, height: 300 })
  assert.deepEqual(dragRect(r, "se", 100, 50, bounds), { x: 100, y: 100, width: 500, height: 350 })
  assert.deepEqual(dragRect(r, "nw", -500, -500, bounds), { x: 0, y: 0, width: 500, height: 400 })
  assert.deepEqual(dragRect(r, "e", -1000, 0, bounds).width, 16, "never smaller than the minimum")
  const locked = dragRect(r, "se", 100, 0, bounds, 4 / 3)
  assert.equal(locked.width / locked.height, 500 / 375)
  assert.deepEqual([locked.x, locked.y], [100, 100], "the top-left corner stayed put")
  const grown = dragRect({ x: 0, y: 0, width: 400, height: 300 }, "se", 5000, 5000, bounds, 4 / 3)
  assert.ok(grown.x + grown.width <= 1000 && grown.y + grown.height <= 800)
  assert.ok(Math.abs(grown.width / grown.height - 4 / 3) < 0.01)
  const top = dragRect({ x: 300, y: 300, width: 400, height: 300 }, "n", 0, -100, bounds, 4 / 3)
  assert.equal(top.y + top.height, 600, "the bottom edge stayed put")
})
