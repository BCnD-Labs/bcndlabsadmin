import assert from "node:assert/strict"
import { test } from "node:test"
import { answerDescribeImage, describeImage, looksLikeFileName, useDescribeImage } from "../src/services/describe-image.ts"

test("adding a picture waits for its description, which is empty only when the writer says it is decoration", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "team.png", { type: "image/png" })
  const asked = describeImage(file)
  assert.equal(useDescribeImage.getState().ask?.file, file, "the dialog has the picture to show")
  answerDescribeImage("The team at the workbench")
  assert.equal(await asked, "The team at the workbench")
  assert.equal(useDescribeImage.getState().ask, undefined)

  const decorative = describeImage(file)
  answerDescribeImage("")
  assert.equal(await decorative, "", "decorative means an empty description, not a missing one")

  const cancelled = describeImage(file)
  answerDescribeImage(undefined)
  assert.equal(await cancelled, undefined, "cancelling adds nothing")
})

test("a file name is not a description", () => {
  for (const text of ["team.png", "IMG.JPG ", "photo.webp"]) assert.equal(looksLikeFileName(text), true, text)
  for (const text of ["The team at the workbench", "A png of a pig", ""]) assert.equal(looksLikeFileName(text), false, text)
})
