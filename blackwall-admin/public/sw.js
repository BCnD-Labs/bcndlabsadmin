/*
 * Blackwall service worker. Deliberately small:
 *  - /api/* is never touched: data and sign-in always go to the server.
 *  - Page loads are network-first, so a new build shows up as soon as you're online
 *    (the in-app Update flow keeps working); the last good page is kept for offline starts.
 *  - Hashed build files (/assets/*) never change, so they're served from cache once fetched.
 */
const VERSION = "bw-v1"
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Copy before handing the response to the page; a body can only be read once.
          if (res.ok) {
            const copy = res.clone()
            event.waitUntil(caches.open(SHELL).then((c) => c.put("/", copy)))
          }
          return res
        })
        .catch(() => caches.match("/").then((hit) => hit ?? Response.error())),
    )
    return
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) {
          await cache.put(req, res.clone())
          // Keep the cache from growing across many builds.
          const keys = await cache.keys()
          for (const old of keys.slice(0, Math.max(0, keys.length - 80))) cache.delete(old)
        }
        return res
      }),
    )
  }
})
