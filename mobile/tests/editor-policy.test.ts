import assert from "node:assert/strict"
import { test } from "node:test"
import { requestEditorClose, type CloseChoice } from "../src/native/editing/close-policy.ts"
import { focusScroll, keyboardInset } from "../src/native/editing/keyboard-geometry.ts"

test("keyboard overlap is zero after Android resizes; overlay windows lose only obscured space", () => {
  assert.equal(keyboardInset(48, 480, 528), 0)
  assert.equal(keyboardInset(48, 760, 528), 280)
  assert.equal(keyboardInset(48, 760, null), 0)
  assert.equal(keyboardInset(600, 80, 528), 80)
  assert.equal(focusScroll(50, 440, 86, 100, 400), 92)
  assert.equal(focusScroll(50, 120, 86, 100, 400), 50)
  assert.equal(focusScroll(50, 90, 86, 100, 400), 32)
})

test("clean editors close directly; busy ones cannot close or offer destructive choices", () => {
  let closed = 0, prompts = 0
  const args = { dirty: false, busy: false, close: () => closed++, save: async () => true, prompt: () => prompts++ }
  requestEditorClose(args)
  requestEditorClose({ ...args, dirty: true, busy: true })
  assert.equal(closed, 1); assert.equal(prompts, 0)
})

test("unsaved close supports keep editing, explicit discard and save only after success", async () => {
  let closed = 0, choices: CloseChoice[] = [], accept = false, throws = false
  const args = { dirty: true, busy: false, close: () => closed++, save: async () => { if (throws) throw Error("offline"); return accept }, prompt: (value: CloseChoice[]) => { choices = value } }
  requestEditorClose(args)
  assert.deepEqual(choices.map(c => c.text), ["Keep editing", "Discard", "Save"])
  choices[0].onPress?.(); assert.equal(closed, 0)
  choices[2].onPress?.(); await new Promise(resolve => setImmediate(resolve)); assert.equal(closed, 0)
  throws = true
  choices[2].onPress?.(); await new Promise(resolve => setImmediate(resolve)); assert.equal(closed, 0)
  throws = false; accept = true
  choices[2].onPress?.(); await new Promise(resolve => setImmediate(resolve)); assert.equal(closed, 1)
  choices[1].onPress?.(); assert.equal(closed, 2)
})
