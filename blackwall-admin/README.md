# Blackwall

A personal workspace for keeping track: simple to-dos, a course planner, a calendar that opens a daily log, sticky notes, charts of your own activity, plus connections to the services you use (GitHub, Azure, Cloudflare, website analytics, or anything else).

## The pieces

- **Planner (Productivity):** daily log, calendar, Notes and Tasks use the shared responsive grid. On wide screens the log spans two columns and two row units; calendar/Notes occupy one unit each, with two-column Tasks below them. Narrower screens reflow and phones stack. Step through days, see due work, search notes/tasks, filter Today / Next / All / Done, star and complete tasks. Log edits sync through the server. The old Tasks, Notes and Calendar addresses open the Planner.
- **Tasks:** Google Tasks style. Title, optional details, optional due date, star, done. No priorities, tags, links or dependencies.
- **Header calendar:** the calendar button (left of search) opens a month card while you hover it and closes when you move away; click it to pin it open, and then it auto-hides a few seconds after you leave. Click a day to open that day's log in a dialog. Day dots: red = open tasks due, amber = overdue, grey = a saved log.
- **Home:** an organizational overview with workspace summary links and four saved module panels you choose from **Customize dashboard**, Settings → Dashboard, or each panel’s header menu: Tasks & notes, Assignments & exams, Calendar & agenda, GitHub activity, Website content, Website traffic, or Hidden. Drag a panel by its header onto another square to swap them, or use "Move to position N" in the menu. Project links and today’s saved log join the same grid. Tasks & notes, Website content, Website traffic and Calendar span two columns; smaller modules span one. Fit content is the default; Equal height is optional. Hidden positions take up no space. Projects and Daily log can be hidden separately. The shared layout grows from one to four columns based on available space.
- **Settings:** a modal with General (version, Check for updates, and an Update button when one is found; export, import, clear cache, reset), Dashboard, Appearance, Connections, Server & backups, Shortcuts. Sections and a search box on the left (a menu on phones), then one column of panels with a row per setting.
- **Notifications:** the bell opens a card that slides in from the right, below the header. No notification sources exist yet, so it shows a content-sized connection-needed card with an explicit source label.
- **Notes:** quick notes in the Planner. Type, pick a colour, pin the ones you want on Home; click a note to edit it.
- **Learning (Productivity → Learning):** a simple course planner. **Add learning → Course** stores a course's code, instructor, term, start and end dates, schedule, location, link, credits, tags and colour. Each course holds **assignments, exams, milestones and events**. These are ordinary tasks with a course link, so they also show in Tasks (with the course chip), on the calendar, in search and in Home's optional **Coursework** square. Notes can be linked to a course and show on its page. No LMS connection is required; course records sync through Blackwall. Deleting a course deletes its coursework and unlinks its notes.
- **Insights (Productivity → Insights):** charts computed from your tasks and logs (tasks completed per day, open tasks by due date, a log heatmap, streaks). On phones the heatmap shows eight recent weeks with 32px day targets; **Expand history** reveals the full year without sideways scrolling.
- **GitHub activity (Development):** one page: counts (repos, commits in 30 days, open PRs, failed runs, issues); a card per tracked repository (public/private, branch, stars, GitHub's language bar, a 30-day commit sparkline, check status, PRs, issues, production/preview links); a 26-week commit heatmap across tracked repos; what needs you (review requests first, tracked repos only); and recent commits with avatars, grouped by day. Below 640px, compact stats and repo summaries bring **needs you** near the first screen; **Details**, **History** and **Recent commits** reveal the rest. Tablet and desktop keep full cards. Phone history starts with 12 weeks; **Expand history** reveals all 26 weeks.
- **Website → Posts & pages:** posts as cards with their cover images (Published / Scheduled / Drafts), and the site's pages with a live, scaled-down preview of each. The editor has a cover image, a bounded Markdown writing area with visible autosave status and a **Preview** that renders the post with your site's own header and styles, tags, and a publish panel: **Publish now**, **Schedule…**, **Update post**, **Unpublish**. See *Website publishing* below.
- **Website → Media library:** the images in your site's images folder; upload, copy Markdown, delete.
- **Website → Website traffic:** sized for a small site: Visitors and Pageviews lead, days with visits and busiest day are under **Details**, daily visitor bars stay compact, and top pages/referrers share one panel. Source and date-range labels stay attached to the data.

Sidebar: **Home · Productivity** (Planner, Projects, Learning, Activity insights) **· GitHub activity · Website** (Posts & pages, Media library, Website traffic). Old `/work`, `/content`, `/notes`, `/analytics`, `/productivity/tasks|notes|calendar` and `/development/*` links redirect to the new places.

> **Two ways to run it.** `npm run dev` runs everything on your computer (no sign-in; credentials in a gitignored `.blackwall/` file). The **home-server deployment** (Portainer stack: Postgres + app + backups, behind Tailscale and a password) is the source of truth for connections and credentials. See [deploy/README.md](./deploy/README.md). Workspace records also live in Postgres and sync across all devices that can reach this installation and sign in.

## Install as an app (PWA)

Blackwall is installable from its HTTPS (Tailscale) address and stays the same app as in the browser: same sign-in, same server data. iPhone (Safari): Share → Add to Home Screen. Android (Chrome): ⋮ → Install app. Mac: Chrome/Edge install icon, or Safari → File → Add to Dock. The service worker (`public/sw.js`) never touches `/api/`; page loads are network-first (so in-app updates appear immediately) with the last page kept for offline starts; hashed `/assets/` files are cached. Icons live in `public/icons/`.

## Desktop app (macOS)

`desktop/` is an Electron app for the Mac. Phase 1 is a tabbed browser whose first, pinned tab is your hosted Blackwall. You get the same server, data and sign-in as in the browser, inside a real app: its own window and Dock icon, green-button fullscreen and native menus. It needs no server changes, and the web app's code is untouched.

| Command | What it does |
| --- | --- |
| `npm run desktop:dev` | Compile `desktop/` and run it with Electron (profile: `~/Library/Application Support/Blackwall Dev`) |
| `npm run desktop:build` | Build an unsigned app for this Mac's architecture: `release/mac-arm64/Blackwall.app` and `release/Blackwall-<version>-arm64.dmg` (gitignored) |
| `npm run desktop:test` | Unit tests for the address bar, link rules and config |
| `npx electron desktop/scripts/verify.ts <https-address> <dir>` | End-to-end check of the shell (after `desktop:compile`), with screenshots into `<dir>` |

**Web address.** On first launch the pinned tab asks for your Blackwall address (for example `https://blackwall.example.ts.net`). Change it any time from **Blackwall → Web Address…**. It's stored in `~/Library/Application Support/Blackwall/desktop-config.json`, along with the window size and position and your open tabs. Sign-in, the service worker and site data live in the app's own browser profile next to it. The app stores no passwords.

**Using it.** ⌘T new tab, ⌘W close tab (the pinned tab stays), ⌘L address bar, ⌘[ / ⌘] back/forward, ⌘R reload, ⌘1–9 pick a tab, ⇧⌘[ / ⇧⌘] previous/next tab, ⌘F find in page, ⌘= / ⌘- / ⌘0 zoom, ⌃⌘F fullscreen. Typing something that isn't an address searches DuckDuckGo. Links that open a new window open a new tab instead. Links to other sites from the pinned tab also open in a new tab. Links like `obsidian://` or `mailto:` ask before opening the other app. If a page can't load (server down, Tailscale off) or crashes, the tab shows the reason and a **Retry** button. Tabs and each tab's last page come back when you relaunch. Closing the window keeps Blackwall in the Dock, and clicking the Dock icon reopens it.

**Security.** Web tabs run sandboxed with no preload and no access to the app's internals. All permission requests are denied, except plain-text copy to the clipboard, which Blackwall's Copy buttons use. Downloads always ask where to save. Certificate errors are never bypassed. The tab strip is served from a private `bw-shell://` scheme that web pages can't load. The built app has Electron's hardening fuses set (no `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` or `--inspect`, and only the checked `app.asar` loads).

**First launch of the unsigned app.** The build is ad-hoc signed, not signed with an Apple Developer ID, so Gatekeeper blocks it the first time it comes from a download or another Mac. Right-click (or Control-click) **Blackwall.app → Open → Open**, or use **System Settings → Privacy & Security → Open Anyway**. A build you made on this Mac usually opens directly. To install it, open the `.dmg` and drag Blackwall to Applications.

**Not done yet.** There's no native Blackwall UI yet: the pinned "Native" tab with the bundled UI comes later, page by page. The app isn't signed with a Developer ID or notarized, and has no auto-update (rebuild to update). There are no notification or permission prompts (everything except clipboard write is denied), no history, bookmarks or extensions, and no drag-to-reorder for tabs. `window.open` popups that need their opener (some OAuth flows) won't work, because they open as ordinary tabs. Only macOS builds are set up.

## Run it

```bash
cd blackwall-admin
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server + local connector |
| `npm run build` | Type-check (`tsc -b`), then production build to `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | oxlint |
| `npm run check` | typecheck + lint + build |
| `npm run preview` | Serve the production build (connector included) |
| `node server/main.ts` | Standalone server (what the Docker image runs; needs the env vars in `deploy/.env.example`) |
| `node server/cli.ts …` | `gen-key`, `hash-password`, `import <connections.json>` |

Stack: React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui (Radix, `radix-nova` style), Lucide icons, Recharts (through shadcn `chart`), Zustand, date-fns, React Router 7.

## Connections

Settings → Connections is where you add, edit, test and remove accounts. Setup explains what each connection enables, walks through preparation and details, then shows a test result and a useful next action. Optional publishing branch/folder fields are under Advanced settings. GitHub setup uses personal access tokens; browser OAuth authorization is not implemented yet.

| Type | What you enter | What it feeds |
| --- | --- | --- |
| GitHub | Fine-grained token, read-only: Actions, Checks, Contents, Issues, Pull requests | Development page and Home panel (for repos you track) |
| Azure | Tenant ID, client ID, client secret (service principal), optional subscription | Subscription, resource group and resource counts on the connection card |
| Cloudflare | API token, optional account ID | Zones and their status on the connection card |
| Website analytics | Plausible, Umami or Cloudflare Web Analytics, plus site ID and API key | Home traffic chart, CMS → Site analytics |
| Website publishing | The site's GitHub repository, site URL, and a fine-grained token with **Contents: Read and write** on that repository only (optional: branch, posts folder, images folder, blog index page) | CMS: publish, schedule, update and remove posts; upload images |
| Custom service | URL, username, password/key, your own extra fields, optional check URL (with Bearer, Basic or custom-header auth) | A reachability check on the connection card |

Saving a connection runs a live test against the provider and shows the result (account name, counts, or the provider’s error message). Custom services without a check endpoint are saved without a test; endpoint checks run only when saving or clicking Test. You can add several of each type.

**Settings → Dashboard → Data sources** selects the GitHub and analytics connections used by all corresponding feeds in this browser. Automatic chooses the first working connection. An explicit choice never silently switches accounts; if removed or unavailable, the feed explains the error and links to Choose data source. Publishing and scheduled posts retain their installation-wide connection behavior.

**Website publishing.** For a static site deployed from GitHub (e.g. Azure Static Web Apps, which rebuilds on every push). Publishing makes one commit to the repository with:

- `<posts folder>/<slug>.html`: the post page, built from your blog page's own `<head>` links, header and footer, so it looks like the rest of the site (default folder `pages/blog/posts`);
- `<posts folder>/index.json`: the list of published posts, including each post's Markdown so it can be edited again from any browser;
- your blog index page (default `pages/blog/blog.html`), but **only** the part between `<!-- blackwall:posts -->` and `<!-- /blackwall:posts -->`, which becomes one card per post in the same markup as your hand-written cards. Without those two comments the page isn't touched.

Images go to the images folder (default `assets/blog_images`) as soon as you upload them. Scheduled posts are kept by Blackwall's server (Postgres on the home server) and published by it once a minute when due, so the browser can be closed; failures are shown in the CMS and retried every 10 minutes. Unpublishing removes the page, the index entry and the card in one commit; your draft stays in your shared workspace. Posts go live when the site finishes redeploying. Pages (your hand-built HTML) are listed with live previews but not edited.

**How credentials are handled.** The browser sends secrets once to Blackwall's server (`server/`), which makes all provider calls itself. On the home server they're encrypted with AES-256-GCM (key from `BLACKWALL_SECRET_KEY`, never stored in the database) before going into Postgres. In local development they're in `.blackwall/connections.json` (gitignored, mode 600). The home server requires a password (scrypt hash, signed HttpOnly SameSite cookie, rate-limited login). Sign-in has a **Remember me for 30 days** checkbox, off by default. Checked, the cookie lasts 30 days, so you stay signed in across browser and app restarts. Unchecked, it's a browser-session cookie that ends when the browser or app quits, and the server also stops accepting it after 12 hours. Sessions issued before this change keep working until their 30 days run out. The API only returns redacted records ("saved, ends in …a1b2"), only answers requests from a loopback host, and requires an `X-Blackwall` header, which other websites can't send without a CORS preflight it never approves. A static `vite build` deployed elsewhere has no connector, and the UI says so.

**Verification status.** "Any service" checks were tested end to end. The GitHub, Azure and Cloudflare error paths were tested against the real APIs with invalid credentials. Success paths for GitHub, Azure, Cloudflare and all three analytics providers follow their documented APIs but haven't been run against real accounts yet.

## What's local and what's external

| Area | Source |
| --- | --- |
| Tasks, coursework, courses, daily logs, notes, projects, repository links, drafts, search, your activity charts | Shared server workspace (Postgres at home; `.blackwall/workspace.json` in development) |
| Website traffic, development data, published and scheduled posts, site pages and images | Your connections, labelled **Live**, **Error** or **Not connected** |
| Sample data | Off by default. Settings → Appearance → *Sample data* fills unconnected panels with made-up data labelled **Sample data**, for previewing layouts |

## Your data

- `blackwall.workspace`: browser cache and unsynced workspace records. A versioned Zustand `persist` store (`src/stores/workspace.ts`, `WORKSPACE_VERSION = 4`). The workspace starts empty. Migrations: v1→v2 removed the example records v1 seeded. v2→v3 converted tasks (high/urgent priority became starred; projects dropped), turned notes into sticky notes, and moved calendar events into the matching day's log as lines. v3→v4 added courses; tasks gained optional `courseId`, `learningType` and `time`, and notes an optional `courseId` (nothing to convert).
- `blackwall.workspace.sync`: the last server baseline, used to merge independent device edits. First connection migrates existing browser records and keeps a device recovery copy. A competing edit or deletion of the same record opens a review; download the device copy, then choose device or server edits. Other records merge automatically. Offline edits stay cached and retry on reconnect/focus and every 15 seconds while visible. The header status distinguishes server saves from device-only saves. Sign-in is required before showing the workspace; preferences remain per device.
- PostgreSQL backups include the workspace table automatically. Export/Import and Clear workspace in Settings now affect the shared workspace on **all signed-in devices**. A static hosting deployment without the Blackwall API cannot open the workspace.
- `blackwall.prefs`: interface preferences (workspace name, theme/font, category colors, sidebar labels, retro details, sample data, auto-hide seconds, Home layout/sizing/visibility and GitHub/analytics source selections). Versioned (`PREFS_VERSION = 4`); v1 → v2 added auto-hide and the slot layout, and stored values are sanitised on load.
- Settings → General can **export** and **import** the workspace as JSON, or clear it, and reset preferences to their defaults.
- If storage is unavailable (private mode, quota), the store falls back to memory for the session.

## Navigation

- **Desktop, icon strip (default):** a full-height 60px rail on the left (the red BW mark at the top, a Settings gear at the bottom). Hover an icon (or Tab to it) and that button grows into a 220px pill with its label and a hint from your local data; its pages unfold below the label, starting right of the icon column, so the icons underneath stay uncovered and you can move straight down from icon to icon. The pill overlays the page, so nothing shifts. Hover delays are 60 ms to open and 220 ms to close; moving onto another icon switches instantly (`nav-rail.tsx`).
- **Desktop, full sidebar:** click the red BW mark to switch to a 220px sidebar (click it again to go back; the choice is saved in this browser). Sections with pages open and close on click like folders (→ and ← work too), and the section you're in starts open.
- **Settings** is a modal, not a page: the gear at the bottom of the rail, ⌘, (Ctrl+, elsewhere), or Settings in the phone menu. Sections are on the left with a search box that filters settings across every section. Old `/settings/...` links open the modal over Home.
- **Keyboard:** Tab from the header into the strip. ↑/↓/Home/End move between items, → enters an item's pages, ← returns, Enter goes, Esc closes. After you navigate, focus moves to the page.
- **Phones and small screens:** the ☰ button opens a sheet with the full menu and a Settings button. On touch devices at desktop widths, the first tap on an icon opens it and a second tap goes.

## Theme

Design system: [`docs/design/BLACKWALL_DESIGN.md`](../docs/design/BLACKWALL_DESIGN.md). The `--bw-*` tokens in `src/index.css` are the source of truth, and shadcn variables point at them so `ui/` components follow.

- **Dim (default):** cool slate, flat static panels, a quiet 1px edge and subtle grid. **Dark:** near-black hardware character, softened 2px right/bottom ledges and scanlines. Both use 8px panel corners; overlays keep stronger shadows.
- **Brand and category colors:** red remains the brand/action accent. Blue tasks, violet learning, teal GitHub, amber website content and cyan traffic use recognizable icons with subtle header tints and borders. Settings → Appearance → Category colors switches these to neutral. Readable light-red tokens handle error text. Square status markers and sentence-case source labels keep Connected, Sample data, Not connected and Error explicit. Connected means data was fetched, not continuous monitoring. Home has separate configurable Website content and Website traffic panels, each with its own connection state.
- **Type:** system sans for UI by default, with optional Mono; JetBrains Mono remains for prompts, breadcrumbs and code, Space Grotesk for titles/numbers, Silkscreen for the BW mark.
- **Density:** bounded desktop widgets, content-sized stat strips and course/project/repository cards around 320–360px wide; spare canvas stays empty instead of stretching every panel. Use 32px dense desktop bands, 40px regular rows, 48px or more for two-line content. Phone buttons have a 32px minimum target; compact empty subsections retain roomier first-use variants.
- **Hierarchy:** major panels use readable headings with a small red prompt marker; internal sections use plain labels; selected filters have no shadow and neutral counts. CMS cards share a shorter 2:1 cover area, including real images/previews.
- **Headers:** `PageHeader` feeds the app header's title/badge/actions. Search contracts and optional metadata hides before titles truncate at constrained widths; phone page actions sit below the header. Global + New becomes ghost on pages with actions.
- **Layout:** header and content share a 1280px maximum width. Home previews and Planner size independently to useful content; the old shared slot-height contract is retired. Planner retains notes/log on the left and calendar above tasks on the right. Sibling links keep Productivity and CMS destinations visible. Empty and disconnected views use compact guidance rather than full-width surfaces.

The background grid and scanlines can be turned off in Settings → Appearance (Retro details), and motion respects `prefers-reduced-motion`.

## Project layout

```text
src/
  components/
    ui/          shadcn components (generated; lightly adjusted for the theme)
    layout/      app shell, header, nav rail, mobile nav, search, quick-create
    forms/       record dialogs (task, event, note, project, repo) + shared fields
    common/      page header, panel, field, list rows and table, tabs, empty state, badges
  features/      home, work (tasks, projects), learning, journal, notes, development, content (CMS), analytics, settings
  services/      connector client, data feeds (live / sample / not connected)
  stores/        workspace (versioned persistence), prefs, ui state
shared/          connection types and provider field definitions (UI + connector)
server/          API (app.ts), dev plugin, standalone server (main.ts), stores (file / Postgres), auth, provider adapters
deploy/          Portainer stack, backup job, deployment guide
  lib/           types, dates, ids, routes
```

## Adding a provider

1. Add its fields to `PROVIDERS` in `shared/connections.ts`. Mark secret fields `secret: true`, and the form picks them up automatically.
2. Write a `test…` function in `server/providers/` and register it in `server/providers/index.ts`.
3. If it feeds a panel, add a route in `server/plugin.ts` and a feed hook in `src/services/data.ts`.

The workspace API uses atomic revision checks; stale clients cannot overwrite newer server data. There is deliberately no arbitrary SQL execution UI.

## Upstream sources and licenses

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). In short: shadcn/ui components (MIT) generated with the shadcn CLI; layout and global-search patterns informed by shadcn/ui Blocks and satnaing/shadcn-admin (MIT); fonts under the SIL Open Font License.

Workspace and source-selection tests: `node --test tests/workspace.test.ts tests/feed-connections.test.ts` (Node 24; uses disposable files and a loopback API).

The shared visual rules live in `src/styles/theme.css`: colors, text roles, 32px controls, 28px desktop compact controls, 40px navigation, 36px panel headers, 12px gutters, and 320px preview units. `WorkspaceGrid` / `GridItem` give every section the same responsive columns. Full collections and editors grow with content. See [the design system](../docs/design/BLACKWALL_DESIGN.md).



### Planner: calendar, focus and optional reflection

Planner uses the approved calendar-over-notes/log canvas, with a selected-task inspector to the right. Day, Week and Month show existing deadlines and optional separate scheduled slots; choose **Tasks** to retain Today/Next/All/Done filtering, stars and search. Select a task and use **Details → Focus on [date]** to put it in that day's focus strip.

Completing a task in Planner opens **Reflection** without requiring an entry. **How did it go?** accepts ordinary text; **+ Add reflection item** optionally reveals difficulty, time spent, help used, outcome, next time, what I learned, or what got in the way. Picklists also offer **Write my own**. Added fields can be removed. Drafts use the existing browser outbox and authenticated server sync; server/offline/conflict status remains in the shared rail indicator. No new external service is used.

**Linked records** connects existing notes, task/calendar items and dated daily logs. **Add to daily log** explicitly copies the reflection to the selected day's log and links it; repeated clicks cannot duplicate an identical entry. There is no separate event collection: timed tasks/coursework are the existing calendar items. Reflections and scheduling fields are optional extensions on Task records, validated on imports and API writes; no existing records are converted or removed.

Validation: `npm run check` and `node --test tests/*.test.ts`. PostgreSQL integration requires `TEST_DATABASE_URL`.
