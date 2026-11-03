import assert from "node:assert/strict"
import { test } from "node:test"
import { sanitizeViewMode, VIEW_MODES } from "../src/lib/view-mode.ts"
import { SAMPLE_COURSES, SAMPLE_COURSEWORK, SAMPLE_EVENTS, SAMPLE_NOTES, SAMPLE_REPOS, SAMPLE_TASKS } from "../src/native/sample.ts"

test("web is always the default; native is only used when stored and available", () => {
  assert.equal(sanitizeViewMode(null, true), "web")
  assert.equal(sanitizeViewMode("native", true), "native")
  assert.equal(sanitizeViewMode("native", false), "web")
  assert.ok(VIEW_MODES.find((m) => m.mode === "web")?.available)
})

test("sample data has unique ids and valid references", () => {
  for (const list of [SAMPLE_COURSES, SAMPLE_COURSEWORK, SAMPLE_TASKS, SAMPLE_EVENTS, SAMPLE_REPOS, SAMPLE_NOTES]) {
    assert.equal(new Set(list.map((x) => x.id)).size, list.length)
  }
  const courses = new Set(SAMPLE_COURSES.map((c) => c.id))
  for (const w of SAMPLE_COURSEWORK) assert.ok(courses.has(w.courseId), w.id)
  for (const t of SAMPLE_TASKS) if (t.courseId) assert.ok(courses.has(t.courseId), t.id)
  for (const x of [...SAMPLE_COURSEWORK.map((w) => w.due), ...SAMPLE_TASKS.flatMap((t) => (t.due ? [t.due] : [])), ...SAMPLE_EVENTS.map((e) => e.date)]) {
    assert.match(x, /^\d{4}-\d{2}-\d{2}$/)
  }
})
