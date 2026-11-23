/**
 * A practice run of publishing, entirely on this computer: `node blackwall-admin/server/site-lab.ts`
 * Starts a throwaway Blackwall with a stand-in GitHub and Nextcloud, the real form receiver code, and a
 * local "web host". Nothing here reaches your real server, repository or site, and it all vanishes when stopped.
 * Publishing, the file changes and the live check run the same code as the real thing; only the far ends are pretend.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { handle, type Env, type KV } from "../worker/forms/src/index.ts"
import { siteFromTemplate } from "../shared/sitebuilder.ts"
import { emptyWorkspace } from "../shared/workspace.ts"
import { createApi } from "./app.ts"
import { gitBlobSha } from "./publish-plan.ts"
import { serveStatic } from "./static.ts"
import { FileConnectionStore } from "./store.ts"
import { FileWorkspaceStore } from "./workspace.ts"

const GITHUB = "https://api.github.com/repos/lab/site"
const CLOUD = "https://cloud.lab.test/remote.php/dav/files/lab"
/** A tiny real PNG, so a published picture is a real file. */
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")

const body = async (req: IncomingMessage) => { const parts: Buffer[] = []; for await (const c of req) parts.push(c as Buffer); return Buffer.concat(parts) }
const listen = (server: ReturnType<typeof createServer>, port: number) => new Promise<number>((resolve) => server.listen(port, "127.0.0.1", () => resolve((server.address() as { port: number }).port)))

function memoryKV(): KV {
  const m = new Map<string, string>()
  return {
    async get(k) { return m.get(k) ?? null },
    async put(k, v) { m.set(k, v) },
    async delete(k) { m.delete(k) },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true } },
  }
}

/** A plain hand-written site: HTML pages in folders, shared CSS, a blog index with the posts region, and one editable region. */
export const HANDWRITTEN: Record<string, string> = {
  "index.html": `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>Example Studio</title>\n  <link rel="stylesheet" href="css/style.css">\n</head>\n<body>\n  <header><nav><a href="index.html">Home</a> <a href="about/index.html">About</a> <a href="blog/blog.html">Blog</a></nav></header>\n  <main>\n    <h1>Example Studio</h1>\n    <section class="intro">\n      <!-- blackwall:intro -->\n      <p>We make small things by hand.</p>\n      <!-- /blackwall:intro -->\n    </section>\n    <p class="mine">This paragraph is hand-written and must never change.</p>\n  </main>\n  <footer>Example Studio</footer>\n</body>\n</html>\n`,
  "about/index.html": `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>About - Example Studio</title>\n  <link rel="stylesheet" href="../css/style.css">\n</head>\n<body>\n  <main><h1>About</h1><p>Hand-written, no regions here.</p></main>\n</body>\n</html>\n`,
  "blog/blog.html": `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>Blog - Example Studio</title>\n  <link rel="stylesheet" href="../css/style.css">\n</head>\n<body>\n  <header><nav><a href="../index.html">Home</a></nav></header>\n  <main>\n    <h1>Blog</h1>\n    <div class="cards">\n      <!-- blackwall:posts -->\n      <!-- /blackwall:posts -->\n    </div>\n  </main>\n</body>\n</html>\n`,
  "css/style.css": "body { font-family: sans-serif; margin: 2rem; }\n.mine { color: #333; }\n",
  "js/app.js": "console.log('hand-written')\n",
}

export async function startSiteLab(opts: { panelPort?: number; sitePort?: number; formsPort?: number; deployMs?: number; /** Start with a hand-written site adopted as a card instead of a Pagesmith site. */ handwritten?: boolean } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "blackwall-site-lab-"))
  const store = new FileConnectionStore(root)
  const workspace = new FileWorkspaceStore(root)

  /* ---- stand-in GitHub: a branch, commits, and a host that picks each commit up after a short "deploy" */
  const branch = { head: "c0", files: new Map<string, Buffer>() }
  const live = { files: new Map<string, Buffer>() }
  const commits: { sha: string; message: string; author?: { name: string; email: string }; committer?: { name: string; email: string }; added: string[]; changed: string[]; removed: string[]; at: string }[] = []
  const blobs = new Map<string, Buffer>(), trees = new Map<string, Map<string, Buffer>>(), made = new Map<string, { message: string; tree: string; parent: string; author?: { name: string; email: string }; committer?: { name: string; email: string } }>()
  const branches = new Map<string, { head: string; files: Map<string, Buffer> }>()
  const pulls: { number: number; title: string; head: string; base: string; body: string }[] = []
  let n = 0
  const nextId = (p: string) => `${p}${++n}`
  const github = async (url: URL, method: string, raw: string, accept: string): Promise<Response> => {
    const p = url.pathname.replace("/repos/lab/site", "") || "/"
    const input = raw ? JSON.parse(raw) : {}
    if (p === "/") return Response.json({ full_name: "lab/site", permissions: { push: true } })
    if (p === "/pages") return new Response("{}", { status: 404 })
    if (p.startsWith("/branches/")) return Response.json({ name: "main" })
    if (p.startsWith("/contents/")) {
      const at = decodeURIComponent(p.slice("/contents/".length))
      const inside = [...branch.files].filter(([f]) => path.posix.dirname(f) === at)
      if (inside.length && !accept.includes("raw")) return Response.json(inside.map(([f, b]) => ({ type: "file", path: f, name: path.posix.basename(f), size: b.length })))
      const file = branch.files.get(at)
      if (!file) return new Response("{}", { status: 404 })
      return accept.includes("raw") ? new Response(new Uint8Array(file)) : Response.json({ type: "file" })
    }
    if (p.startsWith("/git/ref/heads/")) return Response.json({ object: { sha: branch.head } })
    if (p.startsWith("/git/commits/") && method === "GET") return Response.json({ tree: { sha: `base-${branch.head}` } })
    if (p === "/git/blobs") { const sha = nextId("b"); blobs.set(sha, Buffer.from(input.content, "base64")); return Response.json({ sha }, { status: 201 }) }
    if (p.startsWith("/git/trees/") && method === "GET") return Response.json({ tree: [...branch.files].sort(([a], [b]) => a.localeCompare(b)).map(([f, b]) => ({ path: f, type: "blob", sha: gitBlobSha(b) })) })
    if (p === "/git/trees" && method === "POST") {
      const next = new Map(branch.files)
      for (const e of input.tree as { path: string; sha: string | null }[]) { if (e.sha) next.set(e.path, blobs.get(e.sha)!); else next.delete(e.path) }
      const sha = nextId("t"); trees.set(sha, next); return Response.json({ sha }, { status: 201 })
    }
    if (p === "/git/commits" && method === "POST") { const sha = nextId("c"); made.set(sha, { message: input.message, tree: input.tree, parent: input.parents?.[0], author: input.author, committer: input.committer }); return Response.json({ sha }, { status: 201 }) }
    if (p === "/git/refs" && method === "POST") { const name = String(input.ref).replace("refs/heads/", ""); if (branches.has(name)) return Response.json({ message: "Reference already exists" }, { status: 422 }); const commit = made.get(input.sha)!; branches.set(name, { head: input.sha, files: trees.get(commit.tree)! }); return Response.json({ ref: input.ref }, { status: 201 }) }
    if (p === "/pulls" && method === "POST") { const pr = { number: pulls.length + 1, title: input.title, head: input.head, base: input.base, body: input.body }; pulls.push(pr); return Response.json({ html_url: `https://github.com/lab/site/pull/${pr.number}`, number: pr.number }, { status: 201 }) }
    if (p.startsWith("/git/refs/heads/") && method === "PATCH") {
      const commit = made.get(input.sha)!, files = trees.get(commit.tree)!
      if (commit.parent !== branch.head) return Response.json({ message: "Update is not a fast forward" }, { status: 422 })
      const same = (a?: Buffer, b?: Buffer) => !!a && !!b && a.equals(b)
      commits.push({ sha: input.sha, message: commit.message, author: commit.author, committer: commit.committer, at: new Date().toISOString(), added: [...files.keys()].filter((f) => !branch.files.has(f)).sort(), changed: [...files.keys()].filter((f) => branch.files.has(f) && !same(files.get(f), branch.files.get(f))).sort(), removed: [...branch.files.keys()].filter((f) => !files.has(f)).sort() })
      branch.head = input.sha; branch.files = files
      setTimeout(() => { live.files = new Map(files) }, opts.deployMs ?? 3000)
      return Response.json({ object: { sha: input.sha } })
    }
    return Response.json({ error: `lab: no ${method} ${p}` }, { status: 404 })
  }

  /* ---- stand-in Nextcloud: just files in memory, with one sample picture */
  const cloud = new Map<string, Buffer>([["/Blackwall/assets/lab-photo.png", PIXEL]])
  const dav = async (url: URL, method: string, raw: Buffer | undefined): Promise<Response> => {
    const p = decodeURIComponent(url.pathname.replace("/remote.php/dav/files/lab", "")).replace(/\/+$/, "") || "/"
    if (method === "GET") { const f = cloud.get(p); return f ? new Response(new Uint8Array(f)) : new Response("", { status: 404 }) }
    if (method === "PUT") { cloud.set(p, raw ?? Buffer.alloc(0)); return new Response("", { status: 201 }) }
    if (method === "MKCOL") return new Response("", { status: 201 })
    if (method === "DELETE") { cloud.delete(p); return new Response("", { status: 204 }) }
    if (method === "PROPFIND") {
      const row = (href: string, dir: boolean, size: number) => `<d:response><d:href>/remote.php/dav/files/lab${href}</d:href><d:propstat><d:prop><d:getlastmodified>${new Date().toUTCString()}</d:getlastmodified><d:getcontentlength>${size}</d:getcontentlength><d:resourcetype>${dir ? "<d:collection/>" : ""}</d:resourcetype></d:prop></d:propstat></d:response>`
      const inside = [...cloud].filter(([f]) => path.posix.dirname(f) === p)
      return new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${row(p, true, 0)}${inside.map(([f, b]) => row(f, false, b.length)).join("")}</d:multistatus>`, { status: 207 })
    }
    return new Response("", { status: 405 })
  }

  /* ---- everything Blackwall's server would send out goes to the stand-ins instead */
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    const method = init?.method ?? "GET"
    const headers = new Headers(init?.headers)
    if (url === "https://api.github.com/user") return Response.json({ login: "lab-owner", id: 4242, name: "Lab Owner" })
    if (url.startsWith(GITHUB)) return github(new URL(url), method, typeof init?.body === "string" ? init.body : "", headers.get("accept") ?? "")
    if (url.startsWith(CLOUD)) return dav(new URL(url), method, init?.body ? Buffer.from(await new Response(init.body).arrayBuffer()) : undefined)
    return realFetch(input, init)
  }) as typeof fetch

  /* ---- the local "web host": serves whatever the last deploy put live, and counts nothing else */
  const types: Record<string, string> = { ".html": "text/html", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".xml": "text/xml" }
  const siteServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const p = decodeURIComponent(new URL(req.url!, "http://x").pathname).replace(/^\/+/, "")
    if (p === "__lab.json") { res.setHeader("Content-Type", "application/json"); return void res.end(JSON.stringify({ head: branch.head, commits, files: [...live.files.keys()].sort() })) }
    const found = (p ? [p, `${p.replace(/\/$/, "")}/index.html`] : ["index.html"]).find((f) => live.files.has(f))
    if (!found) { res.statusCode = 404; res.setHeader("Content-Type", "text/html"); return void res.end("<h1>404: nothing here</h1>") }
    res.setHeader("Content-Type", types[path.extname(found)] ?? "application/octet-stream")
    res.setHeader("Cache-Control", "no-store")
    res.end(live.files.get(found))
  })
  const sitePort = await listen(siteServer, opts.sitePort ?? 8791)
  const siteOrigin = `http://127.0.0.1:${sitePort}`

  /* ---- the form receiver's real code, with memory instead of Cloudflare's storage and no email */
  const env: Env = { SUBMISSIONS: memoryKV(), ADMIN_TOKEN: "lab", ALLOWED_ORIGINS: siteOrigin }
  const anyMailIsFine = (async () => Response.json({ Status: 0, Answer: [{ data: "mx" }] })) as typeof fetch
  const formsServer = createServer((req, res) => {
    void (async () => {
      const buf = req.method === "GET" || req.method === "HEAD" ? undefined : await body(req)
      const out = await handle(new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: buf ? new Uint8Array(buf) : undefined }), env, anyMailIsFine)
      res.statusCode = out.status
      out.headers.forEach((v, k) => res.setHeader(k, v))
      res.end(Buffer.from(await out.arrayBuffer()))
    })()
  })
  const formsPort = await listen(formsServer, opts.formsPort ?? 8792)
  const formsOrigin = `http://127.0.0.1:${formsPort}`

  /* ---- a starting point: one site, its connections, a form and a sample picture */
  const now = new Date().toISOString()
  const t = siteFromTemplate("Lab site", "portal")
  const website = await store.create({ provider: "website", label: "Lab repository", config: { repo: "lab/site", branch: "main", siteUrl: siteOrigin, ...(opts.handwritten ? { blogIndex: "blog/blog.html", postsDir: "blog/posts", imagesDir: "img" } : {}) }, secrets: { token: "lab" } })
  if (opts.handwritten) for (const [f, text] of Object.entries(HANDWRITTEN)) { branch.files.set(f, Buffer.from(text)); live.files.set(f, Buffer.from(text)) }
  const nextcloud = await store.create({ provider: "nextcloud", label: "Lab cloud", config: { url: "https://cloud.lab.test", username: "lab" }, secrets: { appPassword: "lab" } })
  const forms = await store.create({ provider: "forms", label: "Lab forms", config: { url: formsOrigin }, secrets: { token: "lab" } })
  for (const c of [website, nextcloud, forms]) await store.setResult(c.id, { status: "ok" })
  const snapshot = await workspace.readWorkspace()
  await workspace.writeWorkspace(snapshot.id, snapshot.revision, {
    ...emptyWorkspace(),
    sites: [{ ...t.site, id: "lab", domain: `127.0.0.1:${sitePort}`, formEndpoint: formsOrigin, comments: true, createdAt: now, updatedAt: now, connectionId: website.id, ...(opts.handwritten ? { name: "Example Studio", adopted: true } : {}) }],
    pages: opts.handwritten ? [] : t.pages.map((p, i) => ({ ...p, id: `lab-p${i}`, siteId: "lab", createdAt: now, updatedAt: now })),
    forms: [{ id: "lab-form", name: "Contact", submitLabel: "Send", successMessage: "Thanks!", fields: [{ id: "name", label: "Name", type: "text", required: true }, { id: "message", label: "Message", type: "textarea", required: true }], createdAt: now, updatedAt: now }],
    assets: [{ id: "lab-asset", name: "Lab photo", file: "lab-photo.png", folder: "/Blackwall/assets", mime: "image/png", alt: "A sample photo", width: 1, height: 1, bytes: PIXEL.length, createdAt: now, updatedAt: now }],
  })

  /* ---- Blackwall itself */
  const api = createApi({ store, workspace })
  const dist = path.join(import.meta.dirname, "..", "dist")
  const files = serveStatic(dist)
  const panel = createServer((req, res) => { if ((req.url ?? "").startsWith("/api/")) void api(req, res); else files(req, res) })
  const panelPort = await listen(panel, opts.panelPort ?? 8790)

  return {
    panel: `http://127.0.0.1:${panelPort}`, connection: website.id, site: siteOrigin, forms: formsOrigin, dist, commits, branch, live, branches, pulls, made, store, workspace, api,
    close: async () => {
      globalThis.fetch = realFetch
      for (const s of [panel, siteServer, formsServer]) { s.closeAllConnections(); s.close() }
      rmSync(root, { recursive: true, force: true })
    },
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const lab = await startSiteLab({ handwritten: process.argv.includes("--handwritten") })
  if (!existsSync(path.join(lab.dist, "index.html"))) console.log("Build the panel first: npm --prefix blackwall-admin run build")
  console.log(`\nPractice run is up. Nothing here touches your real data.\n\n  Blackwall:  ${lab.panel}/cms\n  Your site:  ${lab.site}/\n  What was published: ${lab.site}/__lab.json\n\nPress Ctrl+C to stop; it all disappears.\n`)
  process.on("SIGINT", () => void lab.close().then(() => process.exit(0)))
}
