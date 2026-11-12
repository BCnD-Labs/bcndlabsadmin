import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_VIEW, UNSORTED, cleanCollection, collectionsOf, isFiltered, tagsOf, viewAssets, type AssetView } from "../shared/assets.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import type { Asset } from "../src/lib/types.ts"

const ts = (n: number) => `2026-11-0${n}T00:00:00Z`
const asset = (id: string, more: Partial<Asset> = {}): Asset => ({ id, name: id, file: `${id}.webp`, folder: "/Blackwall/assets", mime: "image/webp", width: 10, height: 10, bytes: 100, alt: "", createdAt: ts(1), updatedAt: ts(1), ...more })
const lib = [
  asset("fern", { collection: "Garden", tags: ["plant", "green"], bytes: 300, createdAt: ts(3) }),
  asset("rose", { collection: "Garden", tags: ["plant"], bytes: 100, createdAt: ts(2), alt: "A red rose" }),
  asset("logo", { collection: "Brand", tags: ["logo"], bytes: 900, createdAt: ts(4) }),
  asset("misc", { bytes: 50, createdAt: ts(1) }),
]
const uses: Record<string, number> = { fern: 2, logo: 1 }
const use = (a: Asset) => uses[a.id] ?? 0
const view = (v: Partial<AssetView>) => viewAssets(lib, use, { ...DEFAULT_VIEW, ...v }).map((a) => a.id)

test("collections and tags are counted for the filter lists", () => {
  assert.deepEqual(collectionsOf(lib), [{ name: "Brand", count: 1 }, { name: "Garden", count: 2 }])
  assert.deepEqual(tagsOf(lib), [{ tag: "plant", count: 2 }, { tag: "green", count: 1 }, { tag: "logo", count: 1 }])
  assert.equal(cleanCollection("  Summer   trip  "), "Summer trip")
  assert.equal(cleanCollection("x".repeat(60)).length, 40)
  assert.equal(cleanCollection("   "), "")
})

test("the library view filters by words, collection, tag and use, and sorts", () => {
  assert.deepEqual(view({}), ["logo", "fern", "rose", "misc"], "newest first")
  assert.deepEqual(view({ collection: "Garden" }), ["fern", "rose"])
  assert.deepEqual(view({ collection: UNSORTED }), ["misc"], "pictures in no collection")
  assert.deepEqual(view({ tag: "plant", sort: "name" }), ["fern", "rose"])
  assert.deepEqual(view({ use: "unused" }), ["rose", "misc"])
  assert.deepEqual(view({ use: "used", collection: "Garden" }), ["fern"])
  assert.deepEqual(view({ q: "red rose" }), ["rose"], "searches the description")
  assert.deepEqual(view({ q: "brand" }), ["logo"], "and the collection name")
  assert.deepEqual(view({ sort: "largest" }), ["logo", "fern", "rose", "misc"])
  assert.deepEqual(view({ sort: "oldest" }), ["misc", "rose", "fern", "logo"])
  assert.deepEqual(view({ sort: "unused" }), ["rose", "misc", "logo", "fern"], "unused first, then the least used")
  assert.deepEqual(view({ q: "nothing like this" }), [])
  assert.equal(isFiltered(DEFAULT_VIEW), false); assert.equal(isFiltered({ ...DEFAULT_VIEW, tag: "x" }), true)
  assert.equal(lib.length, 4, "the input isn't reordered")
})

test("a library saved before collections existed still loads, and a collection must be text", () => {
  const data = { ...emptyWorkspace(), assets: [asset("old"), asset("new", { collection: "Garden" })] }
  assert.ok(validWorkspace(data))
  assert.ok(!validWorkspace({ ...data, assets: [{ ...asset("bad"), collection: 4 as unknown as string }] }))
})
