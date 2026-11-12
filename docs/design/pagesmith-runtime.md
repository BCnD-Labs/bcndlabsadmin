# Pagesmith's runtime

Everything JavaScript a visitor runs on a Pagesmith site lives in one file: `pagesmith.js`, at the site root, written by `buildSite`. The page's `<script src="/pagesmith.js" defer>` loads it after the body.

The only exception is a tiny before-paint hint in the `<head>` that reads the saved light/dark choice and sets `data-theme` before the browser paints, so visitors never see a flash. Its bytes are fixed (`THEME_INLINE_BODY` in `shared/site-bootstrap.ts`); a SHA-256 of that string is what a strict CSP would allow for inline scripts. Everything else is `'self'`.

## Blocks the runtime powers

- **Slideshow** (`carousel`) — prev / next buttons, dot navigation, optional autoplay that pauses on hover or focus and respects `prefers-reduced-motion`.
- **Picture gallery** (`gallery`) — each kid is wrapped in a `data-ps-lightbox` button; clicking opens the picture full size in a `<dialog>`.
- **Code block** (`code`) — a "Copy" button appears in the corner; clicks copy the code to the clipboard (falls back to selection).
- **Counter** (`counter`) — an `IntersectionObserver` starts counting up when the element scrolls into view; one run per element.
- **Popup on a button** (`modal`) — a `data-ps-modal-open="…"` button opens the matching `<dialog class="ps-modal">`, closed by Esc, the close button or the backdrop.
- **Cards with filter buttons** (`filterGrid`) — filter buttons collected from each card's `tag` field hide and show items by `data-tag`.
- **Light / dark button** and **forms** — moved out of inline scripts into this file.

## Nothing else

- No dependency. The runtime imports nothing.
- No CSP change. Every script is served from the site's own folder; the one inline string is hashed.
- Nothing bcndlabs.dev- or capstone-shaped. Each block is a general building block, and the Pagesmith build decides whether it belongs on a page.
