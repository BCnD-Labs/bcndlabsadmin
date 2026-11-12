# Your own code in Pagesmith

Round 3 of the JavaScript plan. The runtime in [pagesmith-runtime.md](pagesmith-runtime.md) covers Pagesmith's built-in behaviour. This doc is about the three places the site owner adds their own.

## Site-wide JavaScript

Site settings → Code holds one textarea. Its contents are written to `custom.js` at the site root, loaded with `defer` after `pagesmith.js`, and wrapped in an IIFE and a try/catch so one mistake doesn't block anything else on the page.

## Per-block JavaScript

Each block's Advanced tab has a "Your JavaScript for this block" textarea beneath the CSS one. Whatever's written runs once for every element matching `.x-<id>`, with that element exposed as `el`:

```js
document.querySelectorAll(".x-abc123").forEach(function (el) {
  // your code
});
```

All snippets go into the same `custom.js`, each wrapped in its own try/catch.

## Embed block

Paste a share URL from YouTube, Vimeo, Loom, CodePen, Calendly or Spotify and the block emits the right iframe. The iframe loads from the provider's own origin with a strict referrer policy and lazy loading. Unknown URLs fall back to a plain link on the published page and show a dashed placeholder in the editor preview.

## What's blocked

- `</script` substrings are escaped so the user's code can't close the surrounding `<script>` tag.
- Each snippet is clamped at 16 KB.
- Services that need their own widget script (Twitter / X, Bluesky, GitHub Gist) are not in the Embed block — they'd need the published site's CSP to list each of their domains.
