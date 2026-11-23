import assert from "node:assert/strict"
import { test } from "node:test"
import { startSiteLab } from "../server/site-lab.ts"
import { addressProblem, guardTarget, pagesOwnsAddress, parseSiteAddress } from "../server/site-target.ts"
import { confirmed } from "./lab-review.ts"

test("addresses are compared by host and path, ignoring case, scheme and a trailing slash", () => {
  assert.deepEqual(parseSiteAddress("https://Owner.github.io/Site/"), { host: "owner.github.io", path: "/site" })
  assert.deepEqual(parseSiteAddress("example.com"), { host: "example.com", path: "" })
  assert.equal(parseSiteAddress("not a url at all %%"), null)
  assert.equal(parseSiteAddress(""), null)
})

test("a GitHub Pages address must belong to the repository that is being written", () => {
  const ok = [
    ["owner/site", "https://owner.github.io/site"],
    ["Owner/Site", "https://owner.github.io/site/"],
    ["owner/owner.github.io", "https://owner.github.io"],
    ["owner/site", "", "owner.github.io/site"],
    ["owner/site", "https://example.com"],
    ["owner/site", ""],
  ] as const
  for (const [repo, url, domain] of ok) assert.equal(addressProblem(repo, url, domain), null, `${repo} ${url} ${domain ?? ""}`)

  const bad: [string, string, string | undefined, RegExp][] = [
    ["owner/site", "https://other.github.io/site", undefined, /account “other”.*repository is owner\/site/],
    ["owner/site", "https://owner.github.io", undefined, /served at owner\.github\.io\/site/],
    ["owner/site", "https://owner.github.io/site/blog", undefined, /served at owner\.github\.io\/site/],
    ["owner/site", "https://owner.github.io/another", undefined, /served at owner\.github\.io\/site/],
    ["owner/owner.github.io", "https://owner.github.io/site", undefined, /main site/],
    ["owner/site", "https://owner.github.io/site", "other.github.io/site", /doesn't match the website connection/],
    ["owner/site", "https://example.com", "example.org", /doesn't match/],
    ["owner/site", "ftp://owner.github.io/site", undefined, /isn't a web address/],
  ]
  for (const [repo, url, domain, why] of bad) assert.match(addressProblem(repo, url, domain) ?? "", why, `${repo} ${url} ${domain ?? ""}`)
})

test("for a custom domain, GitHub Pages' own answer decides when it gives one", () => {
  assert.deepEqual(pagesOwnsAddress("https://example.com", "", { cname: "example.com" }), { ok: true, confirmed: true })
  assert.deepEqual(pagesOwnsAddress("https://example.com", "", { htmlUrl: "https://example.com/" }), { ok: true, confirmed: true })
  assert.equal(pagesOwnsAddress("https://example.com", "", { cname: "other.example" }).ok, false)
  assert.deepEqual(pagesOwnsAddress("https://example.com", "", null), { ok: true, confirmed: false })
})

test("the guard describes the target and flags what it could not confirm; a mismatch is refused", async () => {
  const input = { repo: "owner/site", branch: "main", pages: async () => null }
  const github = await guardTarget({ ...input, siteUrl: "https://owner.github.io/site" })
  assert.deepEqual(github, { target: { repo: "owner/site", branch: "main", siteUrl: "https://owner.github.io/site" }, warnings: [] })
  assert.deepEqual((await guardTarget({ ...input, siteUrl: "https://example.com" })).warnings.map((w) => w.code), ["address-unconfirmed"])
  assert.deepEqual((await guardTarget({ ...input, siteUrl: "" })).warnings.map((w) => w.code), ["no-site-url"])
  await assert.rejects(guardTarget({ ...input, siteUrl: "https://other.github.io/site" }), /account “other”/)
  await assert.rejects(guardTarget({ ...input, siteUrl: "https://example.com", pages: async () => ({ cname: "somewhere-else.example" }) }), /serves somewhere-else\.example/)
})

const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
const body = { post: { title: "Hello", excerpt: "Intro", markdown: "# Hi" } }

test("a request that names no connection is refused instead of using the first one", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    for (const [method, path] of [["GET", "site/scan"], ["GET", "site/media"], ["PUT", "site/posts/hello"], ["POST", "site/media"], ["PUT", "site/region"]] as const) {
      const r = await fetch(`${lab.panel}/api/${path}`, { method, headers, body: method === "GET" ? undefined : JSON.stringify({ ...body, plan: true }) })
      assert.equal(r.status, 409, `${method} ${path}`)
      assert.match((await r.json()).error, /Say which website connection/)
    }
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})

test("a site with no connection of its own does not publish through another one", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    const w = await (await fetch(`${lab.panel}/api/workspace`, { headers })).json()
    delete w.data.sites[0].connectionId
    assert.equal((await fetch(`${lab.panel}/api/workspace`, { method: "PUT", headers, body: JSON.stringify(w) })).status, 200)
    const r = await fetch(`${lab.panel}/api/sites/lab/publish`, { method: "POST", headers, body: JSON.stringify({ plan: true }) })
    assert.equal(r.status, 409)
    assert.match((await r.json()).error, /Choose the GitHub repository this site publishes to/)
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})

test("a publish whose site address and repository disagree is refused at the plan and at the write", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    // A connection whose site URL belongs to another GitHub account than its repository.
    const wrong = await lab.store.create({ provider: "website", label: "Mismatched", config: { repo: "lab/site", branch: "main", siteUrl: "https://someone-else.github.io/site", blogIndex: "blog/blog.html", postsDir: "blog/posts", imagesDir: "img" }, secrets: { token: "lab" } })
    const url = `${lab.panel}/api/site/posts/hello?connection=${wrong.id}`
    const send = (b: object) => fetch(url, { method: "PUT", headers, body: JSON.stringify({ ...body, ...b }) })
    const planned = await send({ plan: true })
    assert.equal(planned.status, 409)
    assert.match((await planned.json()).error, /account “someone-else”.*Nothing was published/)
    assert.equal((await confirmed(send)).status, 409)
    assert.equal(lab.commits.length, 0)

    // The site record's own address must also agree with the connection.
    const w = await (await fetch(`${lab.panel}/api/workspace`, { headers })).json()
    w.data.sites[0].domain = "not-the-same-host.example"
    assert.equal((await fetch(`${lab.panel}/api/workspace`, { method: "PUT", headers, body: JSON.stringify(w) })).status, 200)
    const mismatch = await fetch(`${lab.panel}/api/site/posts/hello?connection=${lab.connection}`, { method: "PUT", headers, body: JSON.stringify({ ...body, plan: true }) })
    assert.equal(mismatch.status, 409)
    assert.match((await mismatch.json()).error, /doesn't match the website connection/)
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})
