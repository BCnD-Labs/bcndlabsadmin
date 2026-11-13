import assert from "node:assert/strict"
import { test } from "node:test"
import { randomBytes } from "node:crypto"
import { unzipSync, zipSync } from "fflate"
import { fitWithin, isShrinkable, pictureKind, savedLabel, shrinkOffice, type Reencode } from "../src/features/documents/shrink-office.ts"

const text = (s: string) => new TextEncoder().encode(s)
// Random bytes don't zip any smaller, like a real JPEG.
const noise = (n: number) => new Uint8Array(randomBytes(n))
const deck = (media: Record<string, Uint8Array>) => new Blob([zipSync({ "[Content_Types].xml": text("<types/>"), "ppt/slides/slide1.xml": text("<slide>Hello</slide>".repeat(200)), ...media }) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })

test("which files and pictures are touched", () => {
  assert.equal(isShrinkable("Mod 12.PPTX", 130 * 1048576), true)
  assert.equal(isShrinkable("notes.docx", 40 * 1024), false)
  assert.equal(isShrinkable("old.ppt", 50 * 1048576), false)
  assert.equal(isShrinkable("photo.jpg", 50 * 1048576), false)
  assert.equal(pictureKind("ppt/media/image1.jpeg"), "jpeg")
  assert.equal(pictureKind("word/media/Photo.JPG"), "jpeg")
  assert.equal(pictureKind("xl/media/chart.png"), "png")
  assert.equal(pictureKind("ppt/media/clip.mp4"), null)
  assert.equal(pictureKind("ppt/media/logo.emf"), null)
  assert.equal(pictureKind("ppt/slides/slide1.xml"), null)
  assert.equal(pictureKind("docProps/thumbnail.jpeg"), null)
})

test("pictures shrink to fit but never grow", () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 })
  assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 })
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 })
  assert.deepEqual(fitWithin(1, 5000, 1600), { width: 1, height: 1600 })
  assert.equal(savedLabel(137 * 1048576, 14 * 1048576), "137 MB → 14 MB (90% smaller)")
  assert.equal(savedLabel(3 * 1048576, 3 * 1048576), "3.0 MB → 3.0 MB")
})

test("big pictures are replaced; text, layout and small pictures are copied across untouched", async () => {
  const big = noise(400_000), small = noise(20_000)
  const file = deck({ "ppt/media/image1.jpeg": big, "ppt/media/image2.png": small, "ppt/media/image3.jpeg": noise(300_000) })
  const calls: string[] = []
  const reencode: Reencode = async (bytes, kind) => { calls.push(kind); return bytes.slice(0, 40_000) }
  const progress: [number, number][] = []
  const result = await shrinkOffice(file, { reencode, onProgress: (d, t) => progress.push([d, t]) })
  assert.equal(result.shrunk, 2)
  assert.equal(result.pictures, 2, "the 20 KB picture is too small to bother with")
  assert.deepEqual(calls, ["jpeg", "jpeg"])
  assert.ok(result.after < result.before / 2)
  assert.equal(result.blob.type, file.type)
  assert.deepEqual(progress.at(-1), [2, 2])
  const before = unzipSync(new Uint8Array(await file.arrayBuffer())), after = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
  assert.deepEqual(Object.keys(after), Object.keys(before), "same parts in the same order")
  assert.deepEqual(after["ppt/slides/slide1.xml"], before["ppt/slides/slide1.xml"])
  assert.deepEqual(after["[Content_Types].xml"], before["[Content_Types].xml"])
  assert.deepEqual(after["ppt/media/image2.png"], small)
  assert.equal(after["ppt/media/image1.jpeg"].length, 40_000)
})

test("a picture only changes when the new one is clearly smaller; if nothing shrinks the original comes back as is", async () => {
  const file = deck({ "ppt/media/image1.jpeg": noise(400_000) })
  const same = await shrinkOffice(file, { reencode: async (bytes) => bytes.slice(0, 390_000) })
  assert.equal(same.shrunk, 0)
  assert.equal(same.blob, file)
  const unreadable = await shrinkOffice(file, { reencode: async () => null })
  assert.equal(unreadable.shrunk, 0)
  assert.equal(unreadable.after, unreadable.before)
  const noPictures = await shrinkOffice(deck({}), { reencode: async () => assert.fail("nothing to re-encode") })
  assert.equal(noPictures.pictures, 0)
})
