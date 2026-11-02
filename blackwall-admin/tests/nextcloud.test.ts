import assert from "node:assert/strict"
import { test } from "node:test"
import { cleanPath, parseMultistatus } from "../server/providers/nextcloud.ts"

test("storage paths are normalised and can't climb out of the Nextcloud root", () => {
  assert.equal(cleanPath("Documents//notes.md"), "/Documents/notes.md")
  assert.equal(cleanPath("\\School\\./essay.docx"), "/School/essay.docx")
  assert.equal(cleanPath("/"), "/")
  assert.throws(() => cleanPath("/Documents/../../etc"), /above your Nextcloud root/)
  assert.throws(() => cleanPath(42), /Missing path/)
})

test("a PROPFIND multistatus becomes folders and files with quota", () => {
  const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
 <d:response><d:href>/remote.php/dav/files/vincent/</d:href><d:propstat><d:prop>
  <d:resourcetype><d:collection/></d:resourcetype><d:getlastmodified>Mon, 02 Nov 2026 10:00:00 GMT</d:getlastmodified>
  <d:quota-used-bytes>1000</d:quota-used-bytes><d:quota-available-bytes>9000</d:quota-available-bytes></d:prop></d:propstat></d:response>
 <d:response><d:href>/remote.php/dav/files/vincent/School%20Work/</d:href><d:propstat><d:prop>
  <d:resourcetype><d:collection/></d:resourcetype><oc:size>2048</oc:size><d:getlastmodified>Mon, 02 Nov 2026 09:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>
 <d:response><d:href>/remote.php/dav/files/vincent/notes.md</d:href><d:propstat><d:prop>
  <d:resourcetype/><d:getcontentlength>12</d:getcontentlength><d:getcontenttype>text/markdown</d:getcontenttype>
  <d:getetag>&quot;abc&quot;</d:getetag><oc:fileid>77</oc:fileid><d:getlastmodified>Mon, 02 Nov 2026 08:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>
</d:multistatus>`
  const { entries, quota } = parseMultistatus(xml, "/remote.php/dav/files/vincent")
  assert.deepEqual(quota, { used: 1000, free: 9000 })
  const folder = entries.find((e) => e.name === "School Work")!
  assert.equal(folder.type, "dir")
  assert.equal(folder.path, "/School Work")
  assert.equal(folder.size, 2048)
  const file = entries.find((e) => e.name === "notes.md")!
  assert.deepEqual([file.type, file.size, file.mime, file.etag, file.fileId], ["file", 12, "text/markdown", "abc", "77"])
})
