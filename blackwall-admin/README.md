# Blackwall

A personal workspace for keeping track: simple to-dos, a course planner, a calendar that opens a daily log, sticky notes, charts of your own activity, plus connections to the services you use (GitHub, Azure, Cloudflare, website analytics, or anything else).

## The pieces

- **Planner (Productivity):** one page. Left, one card with **notes** as a compact list (pinned first, search, **+ Note**) beside the selected day: step through days, see what's due, and write its **daily log** (saves as you type). Right, the **calendar** with **tasks** under it (Today / Next / All / Done, search, starred filter, **+ Task** opens the task form due on the selected day). On wide screens it fits the window and each part scrolls on its own; narrower screens stack them. The old Tasks, Notes and Calendar addresses open the Planner.
- **Tasks:** Google Tasks style. Title, optional details, optional due date, star, done. No priorities, tags, links or dependencies.
- **Header calendar:** the calendar button (left of search) opens a month card while you hover it and closes when you move away; click it to pin it open, and then it auto-hides a few seconds after you leave. Click a day to open that day's log in a dialog. Day dots: red = open tasks due, amber = overdue, grey = a saved log.
- **Home:** a 2×2 grid of panels you choose from each panel's header menu: Productivity, Coursework, Calendar, Development, Website, or Empty. Drag a panel by its header onto another square to swap them, or use "Move to slot N" in the menu.
- **Settings:** a modal with General (version, Check for updates, and an Update button when one is found; export, import, clear cache, reset), Appearance, Connections, Server & backups, Shortcuts. Sections and a search box on the left (a menu on phones), then one column of panels with a row per setting.
- **Notifications:** the bell opens a card that slides in from the right, below the header. No notification sources exist yet, so it shows **[ NO SIGNAL ]**.
- **Notes:** quick notes in the Planner. Type, pick a colour, pin the ones you want on Home; click a note to edit it.
- **Learning (Productivity → Learning):** a simple course planner. **Add learning → Course** stores a course's code, instructor, term, start and end dates, schedule, location, link, credits, tags and colour. Each course holds **assignments, exams, milestones and events**. These are ordinary tasks with a course link, so they also show in Tasks (with the course chip), on the calendar, in search and in Home's optional **Coursework** square. Notes can be linked to a course and show on its page. Local only: no LMS connection. Deleting a course deletes its coursework and unlinks its notes.
- **Insights (Productivity → Insights):** charts computed from your tasks and logs (tasks completed per day, open tasks by due date, a log heatmap, streaks).
- **Development:** one page: counts (repos, commits in 30 days, open PRs, failed runs, issues); a card per tracked repository (public/private, branch, stars, GitHub's language bar, a 30-day commit sparkline, check status, PRs, issues, production/preview links); a 26-week commit heatmap across tracked repos; what needs you (review requests first, tracked repos only); and recent commits with avatars, grouped by day.
- **CMS → Posts & pages:** posts as cards with their cover images (Published / Scheduled / Drafts), and the site's pages with a live, scaled-down preview of each. The editor has a cover image, Markdown with a **Preview** that renders the post with your site's own header and styles, tags, and a publish panel: **Publish now**, **Schedule…**, **Update post**, **Unpublish**. See *Website publishing* below.
- **CMS → Media:** the images in your site's images folder; upload, copy Markdown, delete.
- **CMS → Site analytics:** sized for a small site: visitors, pageviews, days with visits, busiest day, daily visitor bars, top pages and referrers.

Sidebar: **Home · Productivity** (Planner, Projects, Learning, Insights) **· Development · CMS** (Posts & pages, Media, Site analytics). Old `/work`, `/content`, `/notes`, `/analytics`, `/productivity/tasks|notes|calendar` and `/development/*` links redirect to the new places.

> **Two ways to run it.** `npm run dev` runs everything on your computer (no sign-in; credentials in a gitignored `.blackwall/` file). The **home-server deployment** (Portainer stack: Postgres + app + backups, behind Tailscale and a password) is the source of truth for connections and credentials. See [deploy/README.md](./deploy/README.md). Tasks, notes and logs are still saved per browser for now.

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

Settings → Connections is where you add, edit, test and remove accounts. Nothing is hard-coded.

| Type | What you enter | What it feeds |
| --- | --- | --- |
| GitHub | Fine-grained token, read-only: Actions, Checks, Contents, Issues, Pull requests | Development page and Home panel (for repos you track) |
| Azure | Tenant ID, client ID, client secret (service principal), optional subscription | Subscription, resource group and resource counts on the connection card |
| Cloudflare | API token, optional account ID | Zones and their status on the connection card |
| Website analytics | Plausible, Umami or Cloudflare Web Analytics, plus site ID and API key | Home traffic chart, CMS → Site analytics |
| Website publishing | The site's GitHub repository, site URL, and a fine-grained token with **Contents: Read and write** on that repository only (optional: branch, posts folder, images folder, blog index page) | CMS: publish, schedule, update and remove posts; upload images |
| Any service | URL, username, password/key, your own extra fields, optional check URL (with Bearer, Basic or custom-header auth) | A reachability check on the connection card |

Saving a connection runs a live test against the provider and shows the result (account name, counts, or the provider's error message). You can add several of each type.

**Website publishing.** For a static site deployed from GitHub (e.g. Azure Static Web Apps, which rebuilds on every push). Publishing makes one commit to the repository with:

- `<posts folder>/<slug>.html`: the post page, built from your blog page's own `<head>` links, header and footer, so it looks like the rest of the site (default folder `pages/blog/posts`);
- `<posts folder>/index.json`: the list of published posts, including each post's Markdown so it can be edited again from any browser;
- your blog index page (default `pages/blog/blog.html`), but **only** the part between `<!-- blackwall:posts -->` and `<!-- /blackwall:posts -->`, which becomes one card per post in the same markup as your hand-written cards. Without those two comments the page isn't touched.

Images go to the images folder (default `assets/blog_images`) as soon as you upload them. Scheduled posts are kept by Blackwall's server (Postgres on the home server) and published by it once a minute when due, so the browser can be closed; failures are shown in the CMS and retried every 10 minutes. Unpublishing removes the page, the index entry and the card in one commit; your draft stays in the browser. Posts go live when the site finishes redeploying. Pages (your hand-built HTML) are listed with live previews but not edited.

**How credentials are handled.** The browser sends secrets once to Blackwall's server (`server/`), which makes all provider calls itself. On the home server they're encrypted with AES-256-GCM (key from `BLACKWALL_SECRET_KEY`, never stored in the database) before going into Postgres. In local development they're in `.blackwall/connections.json` (gitignored, mode 600). The home server requires a password (scrypt hash, signed HttpOnly SameSite cookie, rate-limited login). The API only returns redacted records ("saved, ends in …a1b2"), only answers requests from a loopback host, and requires an `X-Blackwall` header, which other websites can't send without a CORS preflight it never approves. A static `vite build` deployed elsewhere has no connector, and the UI says so.

**Verification status.** "Any service" checks were tested end to end. The GitHub, Azure and Cloudflare error paths were tested against the real APIs with invalid credentials. Success paths for GitHub, Azure, Cloudflare and all three analytics providers follow their documented APIs but haven't been run against real accounts yet.

## What's local and what's external

| Area | Source |
| --- | --- |
| Tasks, coursework, courses, daily logs, notes, projects, repository links, drafts, search, your activity charts | Saved in this browser |
| Website traffic, development data, published and scheduled posts, site pages and images | Your connections, labelled **Live**, **Error** or **Not connected** |
| Sample data | Off by default. Settings → Appearance → *Sample data* fills unconnected panels with made-up data labelled **Sample data**, for previewing layouts |

## Your data

- `blackwall.workspace`: workspace records. A versioned Zustand `persist` store (`src/stores/workspace.ts`, `WORKSPACE_VERSION = 4`). The workspace starts empty. Migrations: v1→v2 removed the example records v1 seeded. v2→v3 converted tasks (high/urgent priority became starred; projects dropped), turned notes into sticky notes, and moved calendar events into the matching day's log as lines. v3→v4 added courses; tasks gained optional `courseId`, `learningType` and `time`, and notes an optional `courseId` (nothing to convert).
- `blackwall.prefs`: interface preferences (workspace name, retro details, sample data, auto-hide seconds for the calendar and notification cards, and the Home slot layout). Versioned (`PREFS_VERSION = 2`); v1 → v2 added auto-hide and the slot layout, and stored values are sanitised on load.
- Settings → General can **export** and **import** the workspace as JSON, or clear it, and reset preferences to their defaults.
- If storage is unavailable (private mode, quota), the store falls back to memory for the session.

## Navigation

- **Desktop, icon strip (default):** a full-height 60px rail on the left (the red BW mark at the top, a Settings gear at the bottom). Hover an icon (or Tab to it) and that button grows into a 220px pill with its label and a hint from your local data; its pages unfold below the label, starting right of the icon column, so the icons underneath stay uncovered and you can move straight down from icon to icon. The pill overlays the page, so nothing shifts. Hover delays are 60 ms to open and 220 ms to close; moving onto another icon switches instantly (`nav-rail.tsx`).
- **Desktop, full sidebar:** click the red BW mark to switch to a 220px sidebar (click it again to go back; the choice is saved in this browser). Sections with pages open and close on click like folders (→ and ← work too), and the section you're in starts open.
- **Settings** is a modal, not a page: the gear at the bottom of the rail, ⌘, (Ctrl+, elsewhere), or Settings in the phone menu. Sections are on the left with a search box that filters settings across every section. Old `/settings/...` links open the modal over Home.
- **Keyboard:** Tab from the header into the strip. ↑/↓/Home/End move between items, → enters an item's pages, ← returns, Enter goes, Esc closes. After you navigate, focus moves to the page.
- **Phones and small screens:** the ☰ button opens a sheet with the full menu and a Settings button. On touch devices at desktop widths, the first tap on an icon opens it and a second tap goes.

## Theme

**Home C** (spec: [`docs/design/BLACKWALL_DESIGN.md`](../docs/design/BLACKWALL_DESIGN.md)). Dark only. The `--bw-*` tokens in `src/index.css` are the source of truth, and shadcn's variables point at them so `ui/` components follow.

- **Panels:** charcoal `#161719`, 12px radius, a 4px ledge on the right and bottom instead of shadows, faint scanlines, and a 40px terminal-prompt header (`❯ tool $ command`). Floating cards (calendar, notifications, menus, dialogs) are the only things with a drop shadow.
- **One accent:** red `#BC1515` for fills, markers, icons and the `❯` glyph, never for text. Red means brand and attention (failures, errors, unread); amber means overdue or degraded; healthy is a small green square, never green text. Status markers are small squares.
- **Type:** JetBrains Mono for all UI text, Space Grotesk for titles and numbers, Silkscreen for the BW mark and initials.
- **Text contrast:** nothing darker than `#7C818B`. The only red text is `#F08A8A`, for error copy. The focus ring is `#C9CDD3`, because red only reaches about 2.8:1 on panels.
- **Page patterns:** every page uses the shared pieces in `src/components/common/` (page header, field, list row, table, empty state). The app header shows a breadcrumb; the page's own header holds the title. See §7 of the spec.

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

A SQL-backed workspace backend would replace the bodies of the workspace store's `create` / `update` / `remove` actions; components never touch storage directly. There is deliberately no arbitrary SQL execution UI.

## Upstream sources and licenses

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). In short: shadcn/ui components (MIT) generated with the shadcn CLI; layout and global-search patterns informed by shadcn/ui Blocks and satnaing/shadcn-admin (MIT); fonts under the SIL Open Font License.
