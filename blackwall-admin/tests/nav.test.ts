import assert from "node:assert/strict"
import { test } from "node:test"
import { activeDestination, kindFromSearch, learningChildren, matchesRoute } from "../src/components/layout/nav-model.ts"
import type { LearningKind } from "../src/lib/types.ts"

const KINDS: { value: LearningKind; plural: string }[] = [
  { value: "course", plural: "Courses" },
  { value: "certification", plural: "Certifications" },
  { value: "selfpaced", plural: "Self-paced" },
  { value: "skill", plural: "Skills" },
  { value: "reading", plural: "Reading" },
]
const NAV = [
  { id: "home", match: "/" },
  { id: "productivity", match: "/productivity" },
  { id: "learning", match: "/productivity/learning" },
  { id: "cms", match: "/cms" },
]
const at = (path: string) => activeDestination(NAV, path)?.id

test("the most specific section wins, so Learning's routes highlight Learning", () => {
  assert.equal(at("/productivity/learning"), "learning")
  assert.equal(at("/productivity/learning/c-1"), "learning")
  assert.equal(at("/productivity"), "productivity")
  assert.equal(at("/productivity/projects"), "productivity")
  assert.equal(at("/productivity/learningish"), "productivity", "prefixes stop at a segment boundary")
  assert.equal(at("/"), "home")
  assert.equal(at("/cms/posts"), "cms")
  assert.equal(at("/nowhere"), undefined)
  // Order in the list doesn't matter.
  assert.equal(activeDestination([...NAV].reverse(), "/productivity/learning")?.id, "learning")
  // With Learning hidden, the next best section is still found.
  assert.equal(activeDestination(NAV.filter((d) => d.id !== "learning"), "/productivity/learning")?.id, "productivity")
  assert.ok(matchesRoute("/", "/") && !matchesRoute("/", "/cms"))
})

test("Learning children: Courses always; other kinds once they exist, in KINDS order", () => {
  const labels = (records: { kind?: LearningKind }[]) => learningChildren(records, KINDS).map((c) => c.label)
  assert.deepEqual(labels([]), ["Courses"])
  assert.deepEqual(labels([{ kind: "course" }, {}]), ["Courses"], "records without a kind are courses; one kind means no Overview")
  assert.deepEqual(labels([{}, { kind: "certification" }]), ["Overview", "Courses", "Certifications"])
  assert.deepEqual(labels([{ kind: "reading" }, { kind: "skill" }, { kind: "course" }, { kind: "skill" }]), ["Overview", "Courses", "Skills", "Reading"])
  assert.deepEqual(labels([{ kind: "certification" }]), ["Courses", "Certifications"], "Overview needs two kinds of records")
  const links = learningChildren([{}, { kind: "selfpaced" }], KINDS)
  assert.deepEqual(links.map((c) => c.to), ["/productivity/learning", "/productivity/learning?kind=course", "/productivity/learning?kind=selfpaced"])
})

test("the Learning page's ?kind= falls back to All when missing or invalid", () => {
  assert.equal(kindFromSearch("?kind=certification", KINDS), "certification")
  assert.equal(kindFromSearch("kind=reading&x=1", KINDS), "reading")
  assert.equal(kindFromSearch("", KINDS), "all")
  assert.equal(kindFromSearch("?kind=bogus", KINDS), "all")
  assert.equal(kindFromSearch("?kind=", KINDS), "all")
})
