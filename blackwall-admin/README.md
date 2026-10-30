# Blackwall

A personal workspace for keeping track: simple to-dos, a calendar that opens a daily log, sticky notes, charts of your own activity, plus connections to the services you use (GitHub, Azure, Cloudflare, website analytics, or anything else).

## The pieces

- **Tasks:** Google Tasks style. Title, optional details, optional due date, star, done. No priorities, tags, links or dependencies. "Today" shows overdue, due-today and starred tasks; the Tasks page groups everything by when it's due.
- **Calendar & daily log:** internal only. Click any day (on Home or Work → Calendar) to open that day's log, a plain journal note that saves as you type. The log page also lists tasks due and completed that day. Teal dots mark days with a log; amber dots mark days with open tasks.
- **Notes:** sticky notes. Type, pick a colour, pin the ones you want on Home. They save as you type; an emptied note is removed.
- **Analytics → You:** charts computed from your tasks and logs (tasks completed per day, open tasks by due date, a log heatmap, streaks). **Analytics → Website** shows your analytics provider once connected.
- **Projects, Development, Content:** a lighter layer for what you're building: repository links, deployment links, content drafts.

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
| GitHub | Fine-grained personal access token | Development panel, Reviews & issues, repository activity (for repos you track) |
| Azure | Tenant ID, client ID, client secret (service principal), optional subscription | Subscription, resource group and resource counts on the connection card |
| Cloudflare | API token, optional account ID | Zones and their status on the connection card |
| Website analytics | Plausible, Umami or Cloudflare Web Analytics, plus site ID and API key | Home traffic chart, Analytics page |
| Any service | URL, username, password/key, your own extra fields, optional check URL (with Bearer, Basic or custom-header auth) | A reachability check on the connection card |

Saving a connection runs a live test against the provider and shows the result (account name, counts, or the provider's error message). You can add several of each type.

**How credentials are handled.** The browser sends secrets once to Blackwall's server (`server/`), which makes all provider calls itself. On the home server they're encrypted with AES-256-GCM (key from `BLACKWALL_SECRET_KEY`, never stored in the database) before going into Postgres. In local development they're in `.blackwall/connections.json` (gitignored, mode 600). The home server requires a password (scrypt hash, signed HttpOnly SameSite cookie, rate-limited login). The API only returns redacted records ("saved, ends in …a1b2"), only answers requests from a loopback host, and requires an `X-Blackwall` header, which other websites can't send without a CORS preflight it never approves. A static `vite build` deployed elsewhere has no connector, and the UI says so.

**Verification status.** "Any service" checks were tested end to end. The GitHub, Azure and Cloudflare error paths were tested against the real APIs with invalid credentials. Success paths for GitHub, Azure, Cloudflare and all three analytics providers follow their documented APIs but haven't been run against real accounts yet.

## What's local and what's external

| Area | Source |
| --- | --- |
| Tasks, daily logs, notes, projects, repository links, drafts, search, your activity charts | Saved in this browser |
| Website traffic, development data | Your connections, labelled **Live**, **Error** or **Not connected** |
| Sample data | Off by default. Settings → Appearance → *Show sample data* fills unconnected panels with made-up data labelled **Sample data**, for previewing layouts |

## Your data

- `blackwall.workspace`: workspace records. A versioned Zustand `persist` store (`src/stores/workspace.ts`, `WORKSPACE_VERSION = 3`). The workspace starts empty. Migrations: v1→v2 removed the example records v1 seeded. v2→v3 converted tasks (high/urgent priority became starred; projects dropped), turned notes into sticky notes, and moved calendar events into the matching day's log as lines.
- `blackwall.prefs`: interface preferences (workspace name, pinned rail, edge reveal, retro details, sample data).
- Settings → Appearance can **export** and **import** the workspace as JSON, or clear it.
- If storage is unavailable (private mode, quota), the store falls back to memory for the session.

## Navigation

- **Desktop:** a thin icon strip is always on the left, like a collapsed browser sidebar, with Settings at the bottom. Hover an icon (or Tab to it) and only that item grows out into its label and its pages; click the label or a page to go. The other icons stay compact and reachable, and the expansion overlays the page, so nothing shifts. Hover delays are 60 ms to open and 220 ms to close (`nav-rail.tsx`).
- **Keyboard:** Tab from the header into the strip. ↑/↓/Home/End move between items, → enters an item's pages, ← returns, Enter goes, Esc closes. After you navigate, focus moves to the page.
- **Phones and small screens:** the ☰ button opens a sheet with the full menu. On touch devices at desktop widths, the first tap on an icon opens it and a second tap goes.

## Theme

**Neo-brutalism × retro hacker / Tron, with rounded corners.** Defined as semantic CSS variables in `src/index.css`. The `dark` class is always on `<html>`, so shadcn's dark variants apply.

- **Blocks:** panels, buttons, dialogs and menus use a 2px "edge" border and a hard offset shadow (`.brutal`, `shadow-brutal*`). Primary buttons are amber with an ink border and press down on click.
- **Terminal touches:** mono uppercase labels, a faint 32px grid behind the page, scanlines on the header, a dotted rail, a neon-glow wordmark and active states, `[ NO SIGNAL ]` for unconnected panels.
- **Colour coding:** each area gets an accent chip (Tasks amber, Calendar teal, Notes magenta, Traffic blue, Development lime) so you can find things at a glance.
- **Type:** Space Grotesk for headings, Atkinson Hyperlegible for text, Atkinson Hyperlegible Mono for labels and data, Jersey 10 (pixel) for the wordmark and big numbers.
- **Sticky notes:** bright paper colours with dark ink.

All text colours are at least 5.9:1 against panels; secondary text is 7.3:1. The chart teal/amber pair is deliberately brighter than a muted palette would be (part of the neon look) and still passes colour-blind separation (ΔE 16.7) and 3:1 contrast. Retro texture can be turned off in Settings → Appearance, and motion respects `prefers-reduced-motion`.

## Project layout

```text
src/
  components/
    ui/          shadcn components (generated; lightly adjusted for the theme)
    layout/      app shell, header, nav rail, mobile nav, search, quick-create
    forms/       record dialogs (task, event, note, project, repo) + shared fields
    common/      panel, source badge, tags
  features/      home, work, development, content, analytics, knowledge, settings
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
