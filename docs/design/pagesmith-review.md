# Pagesmith review: how it compares, and what changed

Pagesmith is Blackwall's website builder (the Website section). You pick a starting point, edit pages made of sections and blocks, write posts in Markdown, and Blackwall builds a plain static site: HTML, `theme.css`, `style.css`, a sitemap and redirects. This note records how it measured up against the tools it is a small alternative to, and what the guided pass changed.

## What the others do that mattered

| | Wix / Squarespace | WordPress (+ block editor) | Webflow | Ghost / Hugo + a CMS | Pagesmith before | Pagesmith now |
|---|---|---|---|---|---|---|
| Tells you what to do next | Setup checklist, "Get found" tasks | Site Health, launch checklist | Little | A little | Nothing: you had to know to open Site settings, Posts, Forms | **Set up your site** checklist that ticks itself off from what you did |
| Edit on the page | Click the text on the page | Click the block on the page | Click the element | Edit in a form | Edit in an outline tree; preview only looked | **Click anything in the preview** and its fields open in the outline |
| Add something | Gallery of ready-made sections, shown as they will look | Pattern library with previews | Component panel | n/a | A text menu of names | **Add a section** gallery, each shown in the site's own colors and type |
| Themes | Pick a theme, change fonts and colors with live view | Theme + Site Editor | Style panel | Theme files | Six color sets in Site settings | **Look** tab: theme, type, corners, width and fine-tuned colors beside a live preview; copy the look of another site |
| Templates | Many, plus "save as template" | Block patterns, starter sites | Clone | Starter repos | Five built-in only | Five built-in plus **My templates** (keep any site as a template) |
| Check before launch | SEO checklist, mobile check | Site Health / plugins | Audit panel | none | none | **Before you go live** list: placeholder text, empty pages, dead links, forms that can't send, missing descriptions, low contrast |
| Get it online | One-click publish to their host | Host-managed | Publish | git push | GitHub publish only (needs a connected repository) | Download all files as a **.zip**, copy any file, or publish to GitHub when a repository is connected |
| Bring an existing site | Importers | Importers | Paste | Markdown files | None | **Paste a page**: an existing page's HTML becomes a Custom HTML block |
| Navigation | Always-visible site menu | Admin menu | Left bar | Left bar | Pages, Posts, Forms, Settings reachable only by small buttons buried in a panel | Tabs on every Website screen: Pages, Posts, Look, Forms, Settings, Get files |

## What changed

- **Website tabs** on every screen, with counts.
- **Set up your site** checklist (Look, replace placeholder text, add a page, first post, domain and footer, check and get files). It reads your real data, so a step is ticked only when it is done, and can be hidden and brought back.
- **Page editor**: click a block in the preview to edit it; the preview keeps its scroll position while you type; clicking a menu link in the preview opens that page's editor; a section gallery with live thumbnails; duplicate and delete (with undo) a page; the home page can't be deleted or given an address; on narrow windows Edit and Preview are one tap apart.
- **New page**: pick a kind (About, Contact, Projects, Services, Blog, Course portal, Gallery, Links, Blank) and it arrives with sections laid out and its own title as the page heading. Or paste an existing page's HTML.
- **Look** tab and three new site settings (type, corners, width), written into `theme.css` as variables so existing sites keep their look until changed.
- **Get files** tab: the site check, a .zip, a file browser with Copy, the picture files your pages expect, and GitHub publish when connected. "Changed since you last got the files" now counts a download or copy as well as a publish.
- **Posts on a Pagesmith site** preview inside the site's own header, menu, colors and type; the cover is a site path (no upload); with no repository connected the button is "Add to the site" instead of "Publish".
- **Custom HTML block** for embeds or sections brought from another site.
- **Template flag** on a site (Settings) so New site offers it under My templates.
- A bug fixed on the way: opening New page or New site could crash the view with React error 185 (a selector that built a new list on every render).

All new site fields are optional. An older saved workspace loads unchanged (see `tests/sitebuilder.test.ts`).

## Not done yet (in the order I'd do them)

1. **Drag to reorder** blocks and sections (today: up/down arrows).
2. **Menu structure**: drop-down menus and a separate footer menu (today the menu is every page marked "in the menu", in order).
3. **Per-site Mac window integration**: open Look beside the page you are editing as two windows.
4. **Posts**: tags page, post list on its own page with paging, RSS.

## Asset library (added after the first pass)

Pictures now come from one place, the **Assets** tab, and Pagesmith can only use pictures from it.

- **Where the files live:** in your Nextcloud, in one folder (default `/Blackwall/assets`, changeable on the Assets tab). Blackwall stores no image bytes; the library is a list of small records (name, file, size, description, tags, where it came from) kept with the rest of your workspace. This uses the Nextcloud connection and the Mikoshi storage endpoints that already exist, so nothing new runs on the server.
- **Adding a picture:** from Nextcloud (a folder browser) or from this computer (a file picker or drag and drop). The original is never changed.
- **Preparing it:** crop with a draggable box (free, original, 1:1, 4:3, 3:2, 16:9, 4:5, 3:1), turn and flip, set the size by longest edge or exact width, pick WebP, JPEG or PNG, set the quality or "keep under N KB", and see the real result size ("1200 × 675 · WebP · 34 KB, 98% smaller") before saving. Re-encoding also drops hidden camera data such as location.
- **Using it:** an Image block, a post cover and a post's Picture button open the library to choose from. The picture's description fills in the block's description. Pictures are written into the site as `images/<file>` with their width and height, so pages don't jump as they load.
- **Editing later:** open a picture, change it, and either save a copy or replace it everywhere it is used (when the file type stays the same).
- **The site check** flags a picture that isn't from the library, and a published post that uses one that isn't.
- **Get files:** the .zip contains the pictures a site uses, in `images/`.

Not yet: publishing to GitHub doesn't carry the library's pictures (the .zip does), and the library isn't offered in the classic Posts flow or outside Pagesmith. AVIF isn't offered because the browser can't encode it.
