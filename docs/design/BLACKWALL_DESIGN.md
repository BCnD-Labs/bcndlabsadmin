# Blackwall design system

> **Current direction (Nov 2026).** The owner set aside earlier style rules except the soft dark default. New work is designed reference-first: name the kit/template a panel follows, and show the panel beside that reference before building. Home's overview panels follow: Pull requests → Devias Kit "Our subscriptions" list (content per Port's developer-homepage guidance), This week → Microsoft Fluent 2 card + agenda, Repositories → Ant Design card with Statistic row and Tiny.Column table. Shared rules: 16px panel radius; a darker, compact title bar (`--bw-titlebar`) with the panel's icon tile in the far-left corner and decorative window squares on the right; 24px between panels and ~20px inside; flat Material tonal pills (bright text on ~16% fill, no outlines); panels sized by content. GitHub accounts are one token everywhere: the color + Material Symbol (`@material-symbols/svg-400`, curated set) chosen per GitHub connection in Settings → Connections, shown as a round avatar or a chip. Any number of GitHub connections is supported; each tracked repo can be assigned to one (else the first working connection reads it) via `GET /api/github/accounts`. Customization (prefs v5, per browser): Home is one ordered list of blocks (`src/lib/home-layout.ts`) with visibility and width (narrow = 1 column, wide = 2, full = row; phones stack), edited on Home (Customize: drag, arrows, width, hide, hidden shelf) or Settings → Dashboard; v4 slot layouts migrate in order. Appearance adds accent (`html[data-accent]`, brand/action color only; errors stay red), density (`html[data-density]`) and sidebar section renaming/hiding (`useNav`). Notes, tasks/coursework and courses can carry document links (label + web or app URL such as obsidian://) that open outside Blackwall; script/data URLs are rejected.

The running system is defined by `blackwall-admin/src/styles/theme.css` (palette and sizing) and `src/index.css` (base/component behavior) and the shared components in `src/components/common/`, `src/components/layout/` and `src/components/ui/`. The approved Option A concept sets the direction across the entire organizational dashboard: compact scale, readable hierarchy, connected context and purposeful spacing. It is a visual reference, not a feature or navigation specification. Blackwall keeps its existing modules, routes, data and integrations. Earlier Home C geometry and the fixed Home/Planner height contract have been retired with owner approval.

## Identity and themes

Dim is the default cool slate theme. Dark keeps the original near-black terminal hardware character. Both retain the red brand/action accent, mono breadcrumbs, small-caps labels and the red BW logo. Every major panel header is a window title bar, modeled on the bcndlabs.dev `preview.png` bar: a neutral raised strip (`--bw-titlebar`: Dim `#363c46`, Dark `#1f242e`) with a line below and two decorative window squares (outlined + filled) at the right. Below a 400px header width the squares are dropped instead of wrapping, and they are hidden in Settings. Titled content panels carry a category icon chip at the left, and that chip is the only place category color lives: Productivity blue `#4f9dff` (tasks, notes, calendar, daily log), Learning violet `#a57dff`, Projects pink `#f2649f`, GitHub cyan `#1fc8e0`, Website orange `#ff8a4d` (content, traffic, Cloudflare), Home and custom services neutral. The chip is a 20% wash with a 38% inset ring. Category hues stay clear of the green/amber/red status colors. Settings sections are not categories. Category colors can be disabled in Appearance; icons and labels remain. Other panels keep the `❯` prompt. Red accent colors are never small body text; use the readable light-red error tokens for error copy. White labels on primary red buttons meet AA.

| Role/token | Dim | Dark |
| --- | --- | --- |
| Ground `--bw-ground` | `#1f2228` | `#0b0e14` |
| Panel `--bw-panel` | `#2a2f37` | `#161a22` |
| Raised/hover `--bw-raised` | `#323842` | `#1c212b` |
| Selected `--bw-selected` | `#3a414c` | `#232935` |
| Input well `--bw-well` | `#1c1f25` | `#0f1218` |
| Static edge `--bw-edge` | `#343a44` | `#232a35` |
| Main separator `--bw-line` | `#373d47` | `#232934` |
| Secondary separator `--bw-line-soft` | `#30353e` | `#1c2129` |
| Control boundary `--bw-border` | `#444b57` | `#2a303c` |
| Accent `--bw-red` | `#c92a2a` | `#bc1515` |
| Primary text `--bw-text` | `#e7eaee` | `#e9ecf1` |
| Secondary `--bw-text-2` | `#c8cdd4` | `#c7cdd6` |
| Muted `--bw-muted` | `#aab1bc` | `#a3abb8` |
| Faint `--bw-faint` | `#99a1ad` | `#838c9a` |

Static Dim panels have one 1px edge and no shadow. Dark uses `1px 2px 2px 1px` borders, a light static shadow, and scanlines at alpha `.006`. Overlay elevation uses the separate `--bw-shadow-float` in both themes. Dim grid alpha is `.015`; Dark retains its grid. Appearance → Retro details disables the grid and scanlines. Motion respects reduced-motion preferences.

Keep the five surface tokens, but use fewer visible layers within a section. Softer decorative edges must never replace meaningful input boundaries or focus indicators. Use `text-ink` or `text-ink-2` on selected fills: faint text on selected fails AA in both themes. Dim faint on panel is 5.16:1, on raised 4.53:1, on selected 3.95:1; muted on selected is 4.77:1. Preserve text colors and body size when reducing framing.

## Typography, shape and density

Sans is the default interface font (system stack); Appearance can select Mono. JetBrains Mono remains for terminal prompts, breadcrumbs, code, repository names and keys. Space Grotesk supplies page titles and large values; Silkscreen is reserved for the BW mark. Page titles are 22px/700 from `lg`, 24px on intermediate screens and 20px on phones, with a 26px line height. Home retains its 24px desktop greeting. Body copy is typically 12–14px; small metadata is 10–11px. `.bw-label` is 10.5px/600 with `.07em` spacing and uppercase presentation.

Panels have 8px corners, controls generally 6–8px, and small square markers 1.5–2px. Keep 12px panel gaps and 12–14px content insets. Density describes content rather than forcing every row to one height:

| Density | Minimum height | Use |
| --- | --- | --- |
| Dense | 32px | Compact controls and one-line Planner rows |
| Regular | 40px | Ordinary lists and tables |
| Two-line | 48px or more | Title with metadata, coursework and activity rows |

Shared sizing is defined once in `src/styles/theme.css`; shadcn/Radix components consume the same roles. Regular buttons, inputs, selects, toolbar links and navigation child rows are 32px. Compact buttons/icons are 28px on desktop and 32px on touch layouts; large icons and major rail rows are 40px. Segmented tracks are 32px on desktop (26px tab plus track padding/border); phone tabs retain 32px hit areas. Panel headers use a 36px minimum and may wrap for actions or source labels. Controls use a 6px radius, panels 8px. Density roles are `--bw-row-dense` (32), `--bw-row-regular` (40), and `--bw-row-two-line` (48); long content may grow. Keep typography readable rather than reducing global body size or opacity.

## Responsive workspace grid

`WorkspaceGrid` and `GridItem` in `src/components/common/workspace-grid.tsx` replace page-specific maximum widths and arbitrary proportions. The outer region is a CSS query container: available widths below 560px use one column; 560px uses two; 848px uses three; 1136px uses four. These thresholds measure actual space after the sidebar, so expanding navigation reflows the page automatically. The shared workspace maximum is 1440px, with 12px gaps. `bw-card-grid` uses the same column thresholds for CMS, Media and Learning collections within their own region.

| Grid role | Behavior |
| --- | --- |
| `span={1\|2\|3\|4}` | Equal column units, clamped to the available columns |
| `span="full"` | Full grid width, for toolbars and summary bands |
| `rows={1}` | One 320px preview unit on multi-column layouts |
| `rows={2}` | Two units plus the 12px gutter: 652px |
| No row size | Content height, for full lists, collections, forms and editors |

Preview bodies scroll within their unit, and links open complete destinations. Phones use content height and a single column; no fixed row unit clips mobile content. Collection cards keep consistent widths and aligned rows while their text determines their height. A long editor retains a readable line length. Changing a role in the theme updates every consumer; do not add another page-specific width to approximate the same unit.

## Panel, section and control hierarchy

- **Major panel — `Panel` / `.bw-panel`:** one outer surface, a readable 13px semibold `title` with a small red `❯`, optional source badge, and right-aligned actions. Headers have a 36px minimum and grow for controls or wrapping. The original `tool`/`command` remains in the heading tooltip; callers without a title retain the mono prompt. Every panel has a generated heading ID for its accessible name, unless an explicit label is supplied. Body padding is caller-controlled; list rows carry their own insets.
- **Section:** a plain small-caps heading and related content within the shared surface. Avoid repeating prompts, shadows, filled wells and bottom rules for every subsection. Project repositories/drafts share one panel. Analytics top pages/referrers share one breakdown panel.
- **Control:** distinct input boundary, clear focus, hover and selected state. `SegmentedTabs` has a recessed track, selected fill without shadow and neutral counts. Track height is 32px desktop; phone tab buttons remain 32px. Arrow/Home/End keys select tabs.
- **Overlay — `.bw-float`:** calendar, notifications, dialogs and menus retain elevation and focus behavior. Unconnected Notifications is content-sized at 260px; populated feeds can use the available viewport height.
- **Empty content — `EmptyState`:** icon, title, optional hint and one action, with `py-4`. `roomy` uses left-aligned `py-5` first-use guidance. First-use project/course/repository surfaces use two grid columns; disconnected analytics/media surfaces also use two grid columns. `NoSignal` uses an explicit source badge, “Connection needed”, useful guidance and a connection action; it is distinct from empty local records.

Settings stays a modal capped at 960px, with a 208px desktop section menu, search and a phone section selector. Its cards have quiet 1px boundaries, no static shadow or bottom ledge, plain headers without another separator or repeated red prompt. Each `SettingRow` pairs a title/description and a control. Sidebar and content surfaces remain theme-aware.

## Header and navigation

The header and main content share a centered 1440px maximum width (`--bw-page-max`). The header is a quiet ground-level bar with one bottom separator; the rail also uses the ground surface with a soft right separator. `PageHeader` sends its title, badge, optional subtitle and actions to `usePageHead`; the app header owns the page's single h1. There are no duplicated in-page title blocks. Phone actions render in a row just below the app header. Breadcrumbs remain mono and provide links to parent destinations.

Search yields space to titles: at 768–1023px it is an icon; at 1024–1279px it is 160px on simple pages and an icon on pages with actions. Action pages get 160px search at 1280px, 220px from 1536px; simple pages get 220px from 1280px. The accessible search name and ⌘K shortcut remain available. Optional subtitles wait until 1536px, course status until 1280px. Global + New uses ghost styling on pages with actions so the page's primary action has clear priority.

The 60px icon rail remains the desktop default. The BW mark toggles the saved 220px full tree; Settings opens from the bottom gear. Rail flyouts work with hover and keyboard focus and overlay the page without moving it. Phones use a navigation sheet. Keep the current navigation: Home; Productivity (Planner, Projects, Learning, Activity insights); GitHub activity; Website (Posts & pages, Media library, Website traffic). Existing routes remain unchanged. `SectionNav` exposes the existing sibling destinations below the header in Productivity and CMS, including active state for detail routes. It uses real links, wraps on phones and does not create duplicate features or pages.

## Home overview and Planner workspace

Layout follows shadcn's `dashboard-01` block: equal KPI cards first, then content-sized sections; full width only for genuinely wide content. No surface has a fixed height. Cards in the same row share the tallest card's height, and long content scrolls inside a card (Home modules cap at 24rem from two columns up; phones use content height).

Home: four KPI cards (Open tasks, Coursework this week, Open pull requests, Visitors · 30 days), each linking to its page; external numbers keep their source badge and show a dash when unavailable. Then the four chosen modules as a bento in a 1/2/3-column container grid: positions 1 and 4 wide (two columns), 2 and 3 narrow, so rows fill as 2+1 and 1+2. A closing row holds Projects, Daily log and Linked services (each connection with its status pill; links to Settings → Connections). Customize dashboard and Settings → Dashboard choose and swap modules; the old Fit content / Equal height setting is retired.

The shared `WorkspaceGrid` row units (`rows={1|2}`) are ceilings (`max-height`), not fixed heights, and grid rows stretch so row-mates align.

Planner keeps its owner-approved arrangement and matches the rendered Ant Design reference's proportions (do not enlarge): content | 380px columns, 16px gap; the left card's title bar is the selected day with ‹ Today ›; inside it a 240px divided notes list beside "Due this day" and a daily log that starts at 10 rows and grows as you type; the card is as tall as the longer of the notes list and the log, capped at the bottom of the Tasks card (side by side), after which the notes list and the log scroll on their own; the calendar card holds year/month selects in its title bar and a six-week grid (outside days faded, 24px day pills across the full width, dots for log/due/overdue, arrow-key navigation); Tasks has one primary + Task, a full-width segmented filter and titles that wrap to two lines. Phones stack, calendar and Tasks first.

Ordinary dates are unfilled, day buttons stay 32px, and week gaps are 4px. A six-week month fits in the calendar unit without shrinking dates; its body can scroll if content or text settings need more space. The legacy shared `--bw-slot-h` and exact Home/Planner viewport-edge contract are retired; alignment now comes from shared column and row units.

## Data honesty and content patterns

Every external feed retains a readable `SourceBadge`: Connected, Sample data, Not connected, Error or Loading. Connected means a successful fetch, not ongoing monitoring. Labels use sentence case at medium weight with a small square; source state must remain explicit rather than color-only. Tasks, notes and logs use the shared workspace save indicator rather than external-service badges. Never fabricate totals or decorative charts. Publishing also shows its website connection state explicitly. Home Website content and Website traffic are independent panel choices with independent badges. GitHub and analytics badges include the selected connection label where space allows; tooltips retain the complete source name.

Development keeps full repository cards and history on tablet/desktop. Below 640px, stats compact into a 100px strip with five items; repo summaries retain name/link, branch, status, PR/issue counts and last push. Details reveals description, languages, sparks and extra links. Project labels in repository summaries link to the actual project workspace and have a 32px phone target. Repository previews use one column/row; commit history, attention and activity use two-column row units. Preview bodies scroll as needed when more repositories occupy additional rows. When no repositories are tracked, a bounded first-use card takes precedence over empty stats and duplicate connection panels. History and Recent commits have visible disclosures; review requests and failed runs stay near the first screen. These disclosures reset on navigation and do not add persisted fields.

Phone Development history initially shows 12 recent weeks; Insights shows eight weeks with 32px clickable log dates. Expand history reveals all 26/52 weeks and wraps on phones. Desktop retains full history. Range labels explain what is shown; no mandatory sideways phone interaction is needed. Clicking a log date opens that Planner day. A fresh Insights workspace shows compact guidance linking to Planner until there are tasks or written logs, rather than a full dashboard of zero-valued charts.

CMS grids have no extra outer panel around individual cards. All covers and missing-cover placeholders share a 2:1 area so rows stay even; real images and live page previews remain visible. Missing covers use a quiet solid surface and initials. The editor uses three grid columns beside a one-column publishing/details region, a 76ch writing area and 352px starting body height. Its header says Post editor or Page draft; the editable title appears once in the document. A missing cover uses a compact action rather than a large placeholder, real covers remain visible, and a footer keeps word count and workspace save status visible at every width. Publishing and connections are unaffected by these presentation patterns.

Site analytics leads with Visitors and Pageviews. Days with visits and Busiest day are under Details; range, source, absolute counts and zero days remain visible. Daily visitor bars use an integer axis in a fixed 144px figure, avoiding grid stretch. Top pages and Referrers are sections of one panel.

## Interaction and accessibility checks

Use real buttons, links and inputs, accessible names for icon actions, visible focus, labelled tabs and `aria-expanded` for disclosure. Preserve keyboard date navigation, reduced motion, selection and error states. Phone pages must fit 390px without horizontal document scrolling. Check 32px phone hit areas, long titles and wrapping with actual content. Test Dim and Dark separately and include a six-week month in Planner checks. Source labels must belong to the numbers they qualify.

## Workspace persistence

All authenticated devices share one installation workspace in PostgreSQL. The versioned browser store is a cache/outbox, while appearance and Home module preferences remain device-specific. Startup gates records behind session verification. A compact status line distinguishes server saves, pending changes and offline device-only saves. Browser storage failures explicitly ask the user to keep the tab open or export unsynced edits.

First connection migrates existing browser records and retains a recovery copy. Atomic revision checks reject stale writes; independent records merge, while competing edits/deletions require review. The conflict dialog provides an export and an explicit choice of device or server edits, merging other records. Logs and drafts stage keystrokes immediately; only network saves are debounced, so incoming changes update open editors safely. Import/Clear in Settings affect every signed-in device, and UI copy states this scope. Recovery export remains device-local. No publishing or provider operation is triggered by migration.


## Connection setup and source control

Settings → Connections shows every service exactly once. A summary line counts linked services and connection health (connected, need attention, not tested or link only). **Linked** lists services that have at least one connection, each with what it feeds and one row per connection: status pill, display name, account, last check, Test/Edit/Remove, an always-visible error message when failing, and a Details disclosure for provider summaries. **Available to link** lists the rest with Set up. Connection-record status uses the SourceBadge styling: Connected (last test passed), Error, Not tested, Link only (custom service without an endpoint).

Provider setup uses Prepare → Details & test → Result, with focus moved to each step heading. The preparation page names actual outcomes and prerequisites. Optional publishing branch/folder configuration stays under Advanced settings. A failed test retains the saved record and credentials so a retry updates it. Success offers tracking a repository or opening the appropriate website page. Custom services store details and optionally run a manual HTTP check; they do not imply automatic monitoring or a metrics integration. Legacy account-only custom records remain editable.

Settings → Dashboard chooses explicit GitHub/analytics sources for this browser, or Automatic. Explicit missing/failed choices must show an actionable error and Choose data source, never silently select a different account or substitute sample data. Requests include the chosen connection ID, checked server-side for provider and usable status. Publishing and schedules retain their existing installation-wide source behavior. All layout/appearance/source choices remain per browser, separate from shared workspace records.
