import assert from "node:assert/strict"
import { test } from "node:test"
import type { JournalEntry } from "../src/lib/types.ts"
import { previewLine, recentDayItems, recentDays } from "../src/features/journal/recent-entries.ts"
import { reviewId, writeSlotCheckIn } from "../shared/journal-review.ts"

const t = "2026-11-09T10:00:00.000Z"
const day = (id: string, extra: Partial<JournalEntry> = {}): JournalEntry => ({ id, text: "", createdAt: t, updatedAt: t, ...extra })
const item = (id: string, text: string, extra: object = {}) => ({ id, text, createdAt: t, updatedAt: t, ...extra })

test("preview lines skip markdown markers and blank lines", () => {
  assert.equal(previewLine("\n## shipped\n- the thing"), "shipped")
  assert.equal(previewLine("- first point"), "first point")
  assert.equal(previewLine(""), "")
  assert.equal(previewLine("x".repeat(200)).length, 90)
})

test("a day's pieces are labelled: day log, sections, check-ins and entries", () => {
  const checkIn = writeSlotCheckIn("morning", { mood: "4" })
  const journal: JournalEntry[] = [day("2026-11-09", {
    text: "Older day text",
    sections: [{ id: "s1", title: "Work", text: "Shipped the viewer" }],
    entries: [item(reviewId("daily", "2026-11-09", "morning"), checkIn), item("log_1", "Went for a walk", { sectionId: "s1" }), item("log_2", "Why it was hard", { taskId: "t1" }), item("log_3", "Course note", { courseId: "c1" })],
  })]
  const items = recentDayItems(journal, "2026-11-09")
  assert.deepEqual(items.map((i) => i.label), ["Day log", "Work", "Morning check-in", "Work"])
  assert.equal(items.find((i) => i.label === "Morning check-in")!.text, checkIn)
  assert.ok(!items.some((i) => i.text === "Why it was hard" || i.text === "Course note"), "entries about a task or course stay in Reflections and Learning")
  assert.deepEqual(recentDayItems(journal, "2026-01-01"), [])
})

test("recent days are newest first, skip empty days and reviews", () => {
  const journal: JournalEntry[] = [
    day("2026-11-07", { text: "Seventh" }),
    day("2026-11-09", { entries: [item("a", "Ninth entry")] }),
    day("2026-11-08"),
    day("journal-weekly-2026-11-02", { text: "A review" }),
    day("2026-11-05", { sections: [{ id: "s", title: "Notes", text: "" }] }),
  ]
  assert.deepEqual(recentDays(journal).map((d) => d.day), ["2026-11-09", "2026-11-07", "2026-11-05"])
  assert.equal(recentDays(journal)[0].preview, "Ninth entry")
  assert.equal(recentDays(journal, 1).length, 1)
})
