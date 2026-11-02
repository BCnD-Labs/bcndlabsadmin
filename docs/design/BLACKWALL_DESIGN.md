# Blackwall design system

The running system is defined by `blackwall-admin/src/index.css` and the shared components in `src/components/common/`, `src/components/layout/` and `src/components/ui/`. The approved Option A concept sets the direction across the entire organizational dashboard: compact scale, readable hierarchy, connected context and purposeful spacing. It is a visual reference, not a feature or navigation specification. Blackwall keeps its existing modules, routes, data and integrations. Earlier Home C geometry and the fixed Home/Planner height contract have been retired with owner approval.

## Identity and themes

Dim is the default cool slate theme. Dark keeps the original near-black terminal hardware character. Both retain one red accent for fills and markers, the `❯` prompt on major panels, mono breadcrumbs, small-caps labels and the red BW logo. Red accent colors are never small body text; use the readable light-red error tokens for error copy. White labels on primary red buttons meet AA.

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

Button variants are 30px default, 32px `lg`, 26px `sm`, 22px `xs`, and 32/28/24px icon variants on desktop. Shared Buttons have a 32px minimum height and width below `md`; segmented phone buttons and Planner date buttons are also at least 32px. Form inputs normally use 36px, toolbar inputs 32px. Do not shrink global body text or reduce opacity to gain density.

Desktop widgets use bounded widths instead of filling every available pixel. Stat strips size to their contents at about 160px per metric, constrained to the available width; desktop values are 18px and vertical padding is 8px. Learning cards target roughly 355px in a 1088px content area, project cards about 344px in 1056px, and Development fits its repository cards/history within 1120px. Site analytics is capped at 896px, Insights at 1024px, project associations at 768px, and CMS grids at 1120px. Spare canvas space is intentional. These limits apply from `lg`; Home and Planner now size independently to their content. Phone content stacks and retains readable controls. Course/project card titles use 14px desktop type, and course progress uses 24px rather than 30px.

## Panel, section and control hierarchy

- **Major panel — `Panel` / `.bw-panel`:** one outer surface, a readable 13px semibold `title` with a small red `❯`, optional source badge, and right-aligned actions. Headers have a 36px minimum and grow for controls or wrapping. The original `tool`/`command` remains in the heading tooltip; callers without a title retain the mono prompt. Every panel has a generated heading ID for its accessible name, unless an explicit label is supplied. Body padding is caller-controlled; list rows carry their own insets.
- **Section:** a plain small-caps heading and related content within the shared surface. Avoid repeating prompts, shadows, filled wells and bottom rules for every subsection. Project repositories/drafts share one panel. Analytics top pages/referrers share one breakdown panel.
- **Control:** distinct input boundary, clear focus, hover and selected state. `SegmentedTabs` has a recessed track, selected fill without shadow and neutral counts. Track height is 32px desktop; phone tab buttons remain 32px. Arrow/Home/End keys select tabs.
- **Overlay — `.bw-float`:** calendar, notifications, dialogs and menus retain elevation and focus behavior. Unconnected Notifications is content-sized at 260px; populated feeds can use the available viewport height.
- **Empty content — `EmptyState`:** icon, title, optional hint and one action, with `py-4`. `roomy` uses left-aligned `py-5` first-use guidance. First-use project/course/repository and disconnected analytics/media panels are capped at 512px. `NoSignal` uses an explicit source badge, “Connection needed”, useful guidance and a connection action; it is distinct from empty local records.

Settings stays a modal capped at 960px, with a 208px desktop section menu, search and a phone section selector. Its cards have quiet 1px boundaries, no static shadow or bottom ledge, plain headers without another separator or repeated red prompt. Each `SettingRow` pairs a title/description and a control. Sidebar and content surfaces remain theme-aware.

## Header and navigation

The header and main content share a centered 1280px maximum width. The header is a quiet ground-level bar with one bottom separator; the rail also uses the ground surface with a soft right separator. `PageHeader` sends its title, badge, optional subtitle and actions to `usePageHead`; the app header owns the page's single h1. There are no duplicated in-page title blocks. Phone actions render in a row just below the app header. Breadcrumbs remain mono and provide links to parent destinations.

Search yields space to titles: at 768–1023px it is an icon; at 1024–1279px it is 160px on simple pages and an icon on pages with actions. Action pages get 160px search at 1280px, 220px from 1536px; simple pages get 220px from 1280px. The accessible search name and ⌘K shortcut remain available. Optional subtitles wait until 1536px, course status until 1280px. Global + New uses ghost styling on pages with actions so the page's primary action has clear priority.

The 60px icon rail remains the desktop default. The BW mark toggles the saved 220px full tree; Settings opens from the bottom gear. Rail flyouts work with hover and keyboard focus and overlay the page without moving it. Phones use a navigation sheet. Keep the current navigation: Home; Productivity (Planner, Projects, Learning, Insights); Development; CMS (Posts & pages, Media, Site analytics). `SectionNav` exposes the existing sibling destinations below the header in Productivity and CMS, including active state for detail routes. It uses real links, wraps on phones and does not create duplicate features or pages.

## Home overview and Planner workspace

Home is the organizational overview. Its small summary links show actual local open tasks/overdue work, tracked repository links and local post drafts. These are local record counts; service results retain their own badges inside the relevant modules.

The four saved user-chosen panels remain: Productivity, Coursework, Calendar, Development, Website and Empty. At `lg` they use a balanced two-column grid (1.35:1), and stack below it. Header chevrons open the existing choice/swap menus; header dragging still swaps panels. Card heights follow content, with bounded desktop previews and links to complete destinations. Coursework previews show up to four items, attention previews up to three; the complete lists remain on their existing pages. Pinned notes remain alongside Home tasks, and course labels link coursework back to Learning. Calendar/agenda and tasks/notes use container queries: they stack when a chosen panel is narrower than 480px, independently of the viewport.

Projects and today's daily log sit below those modules as compact cross-section context. Project rows link to real workspaces and count only their actual associated repositories/drafts. The daily-log preview shows the real saved text or an invitation to write; it opens the existing Planner log. Do not manufacture project/task relationships or copy sample records from the mockup.

Planner keeps notes beside the selected day's log, and calendar above tasks in the right column. Its desktop notes column is 224px; the calendar column is 320px. Columns stack below `lg`, notes/log stack below `md`. The writing area starts at 256px, can be resized vertically, and saves as typed. Log lines have a bounded available width. The agenda and task list retain their own scroll limits, filters and date behavior. No viewport-height floor or `--bw-slot-h` couples Planner to Home; their bottoms intentionally differ.

Ordinary dates are unfilled, day buttons stay 32px, and week gaps are 4px. Six-week months grow naturally without squeezing dates or forcing a page-wide writing well. Calendar markers, keyboard navigation, selected-day task defaults and the header's daily-log dialog remain intact.

## Data honesty and content patterns

Every external feed retains a readable `SourceBadge`: Live, Sample data, Not connected, Error or Loading. Labels use sentence case at medium weight with a small square; source state must remain explicit rather than color-only. Local tasks, notes and logs do not need service badges. Never fabricate totals or decorative charts. Publishing also shows its website connection state explicitly. Home Website labels analytics beside Visitors separately from the website content connection badge.

Development keeps full repository cards and history on tablet/desktop. Below 640px, stats compact into a 100px strip with five items; repo summaries retain name/link, branch, status, PR/issue counts and last push. Details reveals description, languages, sparks and extra links. Project labels in repository summaries link to the actual project workspace and have a 32px phone target. Commit history keeps its intrinsic width/height, including when four or more repositories occupy multiple rows. When no repositories are tracked, a bounded first-use card takes precedence over empty stats and duplicate connection panels. History and Recent commits have visible disclosures; review requests and failed runs stay near the first screen. These disclosures reset on navigation and do not add persisted fields.

Phone Development history initially shows 12 recent weeks; Insights shows eight weeks with 32px clickable log dates. Expand history reveals all 26/52 weeks and wraps on phones. Desktop retains full history. Range labels explain what is shown; no mandatory sideways phone interaction is needed. Clicking a log date opens that Planner day. A fresh Insights workspace shows compact guidance linking to Planner until there are tasks or written logs, rather than a full dashboard of zero-valued charts.

CMS grids have no extra outer panel around individual cards. All covers and missing-cover placeholders share a 2:1 area so rows stay even; real images and live page previews remain visible. Missing covers use a quiet solid surface and initials. The editor is capped at 1152px with a 288px publishing/details column, a 76ch writing area and 352px starting body height. Its header says Post editor or Page draft; the editable title appears once in the document. A missing cover uses a compact action rather than a large placeholder, real covers remain visible, and a footer keeps word count and local autosave status visible at every width. Publishing and connections are unaffected by these presentation patterns.

Site analytics leads with Visitors and Pageviews. Days with visits and Busiest day are under Details; range, source, absolute counts and zero days remain visible. Daily visitor bars use an integer axis in a fixed 144px figure, avoiding grid stretch. Top pages and Referrers are sections of one panel.

## Interaction and accessibility checks

Use real buttons, links and inputs, accessible names for icon actions, visible focus, labelled tabs and `aria-expanded` for disclosure. Preserve keyboard date navigation, reduced motion, selection and error states. Phone pages must fit 390px without horizontal document scrolling. Check 32px phone hit areas, long titles and wrapping with actual content. Test Dim and Dark separately and include a six-week month in Planner checks. Source labels must belong to the numbers they qualify.
