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

1. **Pictures.** Pagesmith doesn't store images; an Image block or post cover points at a path like `/images/me.jpg` and you copy the file over. The Get files tab lists every path your pages use. Uploading to the connected repository (as the classic Posts flow does) is the next step.
2. **Drag to reorder** blocks and sections (today: up/down arrows).
3. **Menu structure**: drop-down menus and a separate footer menu (today the menu is every page marked "in the menu", in order).
4. **Per-site Mac window integration**: open Look beside the page you are editing as two windows.
5. **Approved comments in the downloaded files.** They are in the GitHub publish; the browser can't read the inbox, so the .zip leaves them out.
6. **Posts**: tags page, post list on its own page with paging, RSS.
