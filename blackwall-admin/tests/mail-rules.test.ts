import assert from "node:assert/strict"
import { test } from "node:test"
import { displayName, groupFolders, initials, replyRecipients, splitAddresses, subjectFor } from "../shared/mail.ts"

const message = { from: "Sam Rivera <sam@x.test>", to: "me@domain.test, Jo <jo@y.test>", cc: "c@z.test, me@domain.test", replyTo: "" }

test("replies go to the sender, reply all adds the others once, and never yourself", () => {
  assert.deepEqual(replyRecipients(message, "reply", ["me@domain.test"]), { to: "Sam Rivera <sam@x.test>", cc: "" })
  assert.deepEqual(replyRecipients(message, "replyAll", ["me@domain.test"]), { to: "Sam Rivera <sam@x.test>", cc: "Jo <jo@y.test>, c@z.test" })
  assert.deepEqual(replyRecipients({ ...message, replyTo: "list@x.test" }, "reply", []).to, "list@x.test")
  assert.deepEqual(replyRecipients({ ...message, from: "me@domain.test" }, "reply", ["me@domain.test"]).to, "me@domain.test, Jo <jo@y.test>")
  assert.deepEqual(replyRecipients(message, "forward", []), { to: "", cc: "" })
})

test("names, initials and subjects read naturally", () => {
  assert.deepEqual(splitAddresses("Lee, Jordan <j@x.test>"), [{ name: "Lee, Jordan", address: "j@x.test" }])
  assert.equal(displayName("sam@x.test"), "sam@x.test")
  assert.equal(initials("Sam Rivera"), "SR")
  assert.equal(initials("jordan.lee@x.test"), "JL")
  assert.equal(subjectFor("reply", "Re: Plan"), "Re: Plan")
  assert.equal(subjectFor("forward", "Plan"), "Fwd: Plan")
})

test("folders come in the usual mail order, with your own folders and labels apart", () => {
  const f = (path: string, specialUse: string | null = null) => ({ path, name: path.split("/").pop()!, specialUse })
  const grouped = groupFolders([f("Trash", "\\Trash"), f("Labels/Work"), f("Folders/Clients"), f("Starred"), f("INBOX"), f("Sent", "\\Sent")])
  assert.deepEqual(grouped.system.map((x) => x.path), ["INBOX", "Starred", "Sent", "Trash"])
  assert.deepEqual(grouped.folders.map((x) => x.name), ["Clients"])
  assert.deepEqual(grouped.labels.map((x) => x.name), ["Work"])
})
