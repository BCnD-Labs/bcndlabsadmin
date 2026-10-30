# Blackwall

Internal workspace for **bcndlabs**: projects, tasks, agenda, content drafts, knowledge, and (eventually) development and analytics integrations. The public website is the bcndlabs hub. Blackwall is where you go to get work done.

> **Local prototype.** No authentication and no server. Records live in this browser's `localStorage`. Don't store secrets here.

## Run it

```bash
cd blackwall-admin
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`), then production build to `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | oxlint |
| `npm run check` | typecheck + lint + build |
| `npm run preview` | Serve the production build |

Stack: React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui (Radix, `radix-nova` style), Lucide icons, Recharts (through shadcn `chart`), Zustand, date-fns, React Router 7.

## What's real and what's simulated

| Area | Source | Notes |
| --- | --- | --- |
| Tasks, events, notes, projects, repository links, content drafts | **Local** | Full create/edit/delete, persisted across reloads |
| Home counts and status line | **Local** | Derived from stored records |
| Search (⌘K or `/`) | **Local** | Searches tasks, projects, notes, drafts; also navigation and create actions |
| Website traffic (Home, Analytics) | **Demo data** | Deterministic sample series (`services/analytics-demo.ts`). Not bcndlabs.com traffic |
| Reviews, failed checks, issues, repo activity | **Demo data** | Sample GitHub data, filtered to locally tracked repos (`services/github-demo.ts`) |
| External calendar | **Not connected** | Agenda shows local events only |
| Media library, publishing, SQL backend | **Not connected** | Explained in Settings → Integrations |

Every panel shows a badge (`Local`, `Demo data`, or `Not connected`) so sample data can't be mistaken for live data.

## Local data

- `blackwall.workspace`: workspace records. Versioned Zustand `persist` store (`src/stores/workspace.ts`, `WORKSPACE_VERSION = 1`). When the schema changes, bump the version and add a step to `migrate`.
- `blackwall.prefs`: interface preferences (pinned rail, edge reveal, retro details).
- On first load the workspace is seeded with starter records (`src/stores/seed.ts`). These are ordinary local records. Settings → Appearance can **restore starter data** or **clear the workspace**.
- If storage is unavailable (private mode, quota), the store falls back to memory for the session.

## Navigation

- **Desktop:** the rail starts hidden. Hover the far-left edge (a 10px strip), or press the header menu button, to bring up a floating icon rail. Hovering or focusing one icon opens a flyout with only that destination's label and sub-sections. A padded bridge plus open, switch, and close delays (120 / 110 / 380 ms in `nav-rail.tsx`) keep the flyout open while you move between rail and flyout. The rail overlays the page and doesn't shift content.
- **Keyboard:** Tab to the menu button and press Enter (focus lands on the current section). ↑/↓/Home/End move between destinations, → enters the submenu, ← returns, Enter selects, Esc closes and gives focus back to the menu button. After you navigate, focus moves to the main region.
- **Pin rail:** the pin button at the bottom of the rail, or Settings → Navigation. Saved locally. Pinned mode reserves space for the rail.
- **Touch and small screens:** below 768px the menu button opens a conventional sheet with the full tree. On touch devices at desktop widths, the first tap on an icon opens its submenu.

## Theme

A single dim-graphite theme defined as semantic CSS variables in `src/index.css`. The `dark` class is always on `<html>`, so shadcn's dark variants apply.

Changes from the starting palette, made for contrast (WCAG AA):

| Token | Start | Used | Why |
| --- | --- | --- | --- |
| `--muted-foreground` | `#B4BAC3` | `#BCC2CA` | Keeps ≥ 4.5:1 on hover/selected surfaces (`#4A4E55`) |
| `--red-text` / `--destructive` | `#D78F88` | `#E6A8A1` | `#D78F88` is only 3.8:1 on panels; kept for fills and dots |
| `--input` | n/a | `#858B95` | Form-field borders need more contrast than `--border` |
| `--popover` | n/a | `#44474E` | Menus and dialogs sit one step above panels |
| `--chart-1` / `--chart-2` | teal / amber | `#32A89E` / `#BE8832` | Saturated steps of the brand hues. They pass a colour-vision-deficiency separation check against the panel surface |

Amber (`--primary`) is the action colour and teal marks structure (focus rings, borders, local badges), matching bcndlabs.com. Type: Atkinson Hyperlegible for the interface, Atkinson Hyperlegible Mono for technical metadata, Jersey 10 for the wordmark only. All fonts are self-hosted through `@fontsource`. Retro dots and scanlines appear only on chrome (header, rail) and can be turned off. Motion is minimal and switched off under `prefers-reduced-motion`.

## Project layout

```text
src/
  components/
    ui/          shadcn components (generated; lightly adjusted for the theme)
    layout/      app shell, header, nav rail, mobile nav, search, quick-create
    forms/       record dialogs (task, event, note, project, repo) + shared fields
    common/      panel, source badge, tags
  features/      home, work, development, content, analytics, knowledge, settings
  services/      typed integration interfaces + demo/unconnected adapters
  stores/        workspace (versioned persistence), prefs, ui state, seed data
  lib/           types, dates, ids, routes
```

## Future integration points

All external data goes through the interfaces in `src/services/types.ts`. Adapters are registered in `src/services/index.ts`.

- **GitHub** → `DevelopmentService` (pull requests, failed checks, issues, activity).
- **Website analytics** → `AnalyticsService` (traffic, top pages, referrers). No provider is assumed.
- **Calendar** → `CalendarService.listEvents`. Provider-agnostic (CalDAV, ICS, or an API).
- **Workspace backend (SQL / "Soulkiller")** → swap the bodies of the workspace store's `create` / `update` / `remove` actions for API calls. Components never touch storage directly.
- **Media** → a `MediaService` still to be defined.

**Credentials must never reach the browser.** Real adapters should call a small server-side boundary (a serverless function or API) that holds tokens. That boundary is also where authentication belongs once Blackwall stops being local-only. Data/SQL tooling is deliberately out of scope: there is no arbitrary SQL execution UI.

## Upstream sources and licenses

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). In short: shadcn/ui components (MIT) generated with the shadcn CLI; layout and global-search patterns informed by shadcn/ui Blocks and satnaing/shadcn-admin (MIT); fonts under the SIL Open Font License.
