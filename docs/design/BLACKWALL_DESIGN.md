# Blackwall — Design Spec (v1, "Home C")

Source of truth for the Blackwall dashboard look and behavior. The mockup source is
`reference/home-c.dc.html` (read as source; it needs the design tool's runtime to render). All data in it is sample data. Match the look; don't copy its
markup format, and treat everything in it as sample data.

---

## 1. Design tokens

### Themes
Two themes share every component (Settings → Appearance → Theme, saved per browser, applied on `<html data-theme>`
before first paint):
- **Dim (default):** a mid-tone slate between dark and light mode, modelled on Mantine's dark scheme
  (https://mantine.dev, #242424 body / #2E2E2E cards / #424242 borders) with a cool tint. Cards are flat with a 1px
  border and Mantine's `shadow-sm`; no ledge, no scanlines. Key values: ground `#1F2228`, panel `#2A2F37`, raised
  `#323842`, selected `#3A414C`, well `#1C1F25`, border `#444B57`, red `#C92A2A` (Mantine red.9), red-light
  `#FF8F8F`, text `#E7EAEE` / `#C8CDD4` / muted `#AAB1BC` / faint `#99A1AD`.
- **Dark:** the original near-black theme below, with the 4px panel ledge and scanlines.

Components follow Mantine's conventions in both themes: 8px radius; buttons as filled / default / outline / subtle /
light variants with no ledge; 36px inputs whose focus border is red-light; a Mantine-style segmented control and
38×20 switch; pill "light" badges (10px bold caps on a 15% tint) for status, due dates and tags; and the light variant
(15% red tint, red-light icon) for the active nav item. The BW mark stays solid red.

**Interface font** (Settings → Appearance): Sans (Mantine's system stack, default) for UI text, with JetBrains Mono kept
for the `❯` prompt, breadcrumbs, code, repo names, numbers and keys; or Mono everywhere.

### Color (Dark theme)
| Token | Value | Use |
|---|---|---|
| `--bw-ground` | `#0B0E14` | App background |
| `--bw-grid` | `rgba(130,160,200,.045)` | 24px background grid lines |
| `--bw-panel` | `#161A22` | Panel surface |
| `--bw-raised` | `#1C212B` | Cards inside panels, hover rows, flyouts |
| `--bw-selected` | `#232935` | Selected tab / active row fill |
| `--bw-well` | `#0F1218` | Inputs, chart wells, meters |
| `--bw-edge` | `#232A35` | 1px hairline on a panel's top + left edge |
| `--bw-ledge` | `#252B36` | Panel ledge (right + bottom edge) |
| `--bw-ledge-hi` | `#2D3441` | Floating card / selected item ledge |
| `--bw-line` | `#232934` | Dividers inside panels |
| `--bw-line-soft` | `#1C2129` | Row separators |
| `--bw-border` | `#2A303C` | 1px borders on wells, chips, ghost buttons |
| `--bw-red` | `#BC1515` | **The only accent.** Fills, markers, icons, primary buttons |
| `--bw-red-hover` | `#CB2020` | Primary button hover |
| `--bw-red-ledge` | `#6E0C0C` | Ledge under red fills |
| `--bw-amber` | `#DCAA52` | Degraded / overdue / deadline (desaturated for dark) |
| `--bw-green` | `#62D3A2` | Healthy deltas and passing checks only (desaturated) |
| `--bw-blue` | `#7FA3D6` | Reserved for informational states |
| `--bw-text` | `#E9ECF1` | Primary text |
| `--bw-text-2` | `#C7CDD6` | Secondary text |
| `--bw-muted` | `#A3ABB8` | Labels, meta, descriptions (≥ 7:1 on panel) |
| `--bw-faint` | `#838C9A` | Smallest labels (lowest allowed for text, ≥ 4.5:1 on raised) |
| `--bw-off` | `#2A303B` | Unlit meter segments |
| `--bw-check` | `#4A5261` | Checkbox border, log dots, far-future due marker |

Neutrals are a cool slate ramp with a visible step between each surface (ground → well → panel → raised → selected). Panels get a soft drop shadow (`--bw-shadow`) on top of the ledge so they lift off the ground.

Rules:
- `#BC1515` is **never** used for small text (fails contrast on charcoal). Use it for fills, squares, bars, icons, and the `❯` prompt glyph. Text on red is white.
- No glows, gradients or colored panel outlines. Depth comes from the ledge plus a soft, low-contrast drop shadow; floating cards get a deeper one.
- Status markers are small **squares** (6–8px, radius 1.5–2px), not circles.

### Typography (Google Fonts)
- **JetBrains Mono** 400/600/700: all UI text, labels, data, buttons.
- **Space Grotesk** 500/700: big numbers, panel/card titles, page greeting.
- **Silkscreen**: logo mark only (`BW`, avatar initials).
- Labels: 10px, uppercase, letter-spacing .12em, `--bw-faint`.
- Body/data: 11–12px mono. KPI numbers: 22–30px Space Grotesk 700, line-height 1.

### Shape and spacing
- Panel radius 12px; inner cards 8–10px; chips/buttons 5–7px; meter cells 1.5–2px.
- Gaps: 12px between panels, 8–10px inside, panel padding 12–14px.
- Hit targets ≥ 28px in dense UI (and ≥ 40px for sidebar buttons).

---

## 2. The panel (core component)

```
┌──────────────────────────────────────────┐
│ ❯ tool $ command            meta  [⇅]   │  ← 40px header, 1px --bw-line divider
├──────────────────────────────────────────┤
│ content (12–14px padding)                │
│                                          │
└──────────────────────────────────────────┘▌  ← 4px ledge, right + bottom only
 ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▘
```
- `background: --bw-panel; border-radius: 12px; border: solid --bw-ledge; border-width: 0 4px 4px 0;`
- Scanline overlay: `repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 3px)` as a non-interactive `::after`.
- Header = terminal prompt: red `❯`, tool name in muted, grey `$`, command in primary text. Meta on the right.
- Floating cards (calendar dropdown, notifications) use `border-width: 1px 4px 4px 1px; border-color: --bw-ledge-hi` plus `box-shadow: 0 20px 44px rgba(0,0,0,.55)`.

### Sub-components
- **Primary button:** red fill, white 11px/600 mono, 2px `--bw-red-ledge` on right + bottom.
- **Ghost button:** transparent, `--bw-border` 1px top/left + 2px right/bottom.
- **Segmented tabs:** `--bw-well` track; active tab `--bw-selected` with 2px `--bw-ledge-hi` ledge and a red count badge.
- **Segment meter:** a row of 12–24 small cells; lit = red (or amber for degraded), unlit = `--bw-off`.
- **Checkbox:** 15–17px square, 1.5px `#4A4E56` border; checked = red fill + white check.
- **Due chip:** 1px border, colored square + text (amber if overdue).

---

## 3. Home layout ("Home C")

```
┌────┬─────────────────────────────────────────────────────────┐
│rail│ header: greeting · search · +New · [cal] · [bell]       │
│ 60 ├─────────────────────────────────────────────────────────┤
│ px │ STATUS · 4 boxes (user-chosen services)     [customize] │
│    ├────────────────────────────┬────────────────────────────┤
│    │ slot 1 (Productivity)      │ slot 2 (Traffic)           │
│    ├────────────────────────────┼────────────────────────────┤
│    │ slot 3 (GitHub)            │ slot 4 (Services)          │
└────┴────────────────────────────┴────────────────────────────┘
          notifications card floats over the right edge (hidden by default)
```
- **Status row:** 4 boxes. "Customize" swaps each label for a dropdown of available services (Containers, node, site uptime, game servers, Pi-hole, Kuma, GitHub CI…). Persist the choice per user.
- **2×2 grid:** each slot header has a dropdown to pick its panel type: Productivity, Traffic, GitHub, Services, Containers (more later). Persist per user.
- **Productivity panel:** tasks (tabs Today/Next/Done, quick-add on Enter, checkboxes) on the left ~57%, pinned notes on the right.
- Responsive: grid → 1 column under 1100px; status → 2 cols under 1100, 1 col under 720; rail becomes a horizontal top bar under 720.

---

## 4. Behaviors and motion

Easing everywhere: `cubic-bezier(.2,.8,.2,1)`. Quick (150–280ms) but fluid.

### Left rail (hover-extend), and the full sidebar
- Clicking the red BW mark switches between this strip and a 220px sidebar (saved per browser). In the sidebar,
  sections with pages open on click like a folder tree (→ / ← too), and the current section starts open.
- The bottom of the rail is a Settings gear (it replaced the workspace initials) that opens the settings modal.

**The strip:**
- 40×40 icon buttons. Active page = red fill.
- On hover or keyboard focus, **the button itself** grows into one continuous pill (≈220px wide, 200ms): label + status hint fade/slide in, and subpages unfold beneath (grid-rows 0fr→1fr, 220ms). It floats over content (z-index above main) and never reflows the page.
- **Known bug to fix:** the expanded pill covers the icon buttons below it, so you can't move straight from one button to the next. Fix: keep the **icon column (x 0–44px) uncovered**. The subpage list starts at x≈44px under the label (an inverted-L shape that still reads as one piece), or open the subpages to the right of the head row. Collapse instantly when the pointer enters another rail icon.

### Calendar (header, left of search)
- Collapsed by default to a small "📅 Oct 30" ghost button (use a line icon, not an emoji).
- Hovering the button opens the card; moving away closes it at once. Clicking pins it open, and then the
  auto-hide timer below applies.
- The card is a dropdown (fade + 6px drop, 180–220ms) with a month grid and today's agenda. "hide" collapses it.
- Clicking a day opens the **log** dialog for that date (day's events, quick chips: shipped / learned / blocked on / tomorrow, textarea, Save). The log is not on the home page itself.

### Notifications (floating right card)
- Bell button in the header with an unread badge toggles it (click only, no hover). It slides in from the right (translateX, 280ms) **over** the panels, starting below the header bar so it floats, with no dimming and no layout shift. Hidden by default.
- Filters: All / Alerts / Dev / Site. Grouped Today / Yesterday. Unread = bold title + red square; click marks read; "read all".

### Auto-hide (calendar + notifications)
- When the pointer leaves the open card, start a 5s timer (configurable). While pinned/open, the header button (calendar or bell), not the card, gets a 2px red outline; when the pointer leaves the card or its button, that outline retracts clockwise from top-centre over that time. Re-entering restores it. When the timer ends, close. Reduced motion: the outline dims to 50% instead of moving.

---

## 5. Accessibility
- Real `<button>`/`<a>`/`<input>` elements; icon-only buttons get `aria-label`.
- Rail flyouts open on `:focus-within` as well as hover.
- Tabs use `role="tablist"`/`tab` + `aria-selected`; toggles use `aria-expanded`/`aria-pressed`.
- Respect `prefers-reduced-motion` (drop slide/clip transitions to instant).
- Text contrast ≥ 4.5:1: never use `#BC1515` or anything darker than `#7C818B` for text.

## 6. Red and green (decided)
Red means **brand and attention**: the accent fill (primary buttons, the active rail item, the `❯`), chart bars,
and anything that needs you (failed checks, failed backups, errors, unread counts). Healthy is shown with a small
**green `#5EF0B5` square** next to neutral text, never as green text or green links. Amber is overdue / degraded.
Links are `--bw-text-2` with an underline on hover.

---

## 7. Page patterns

Components live in `src/components/common/`. Use these instead of one-off markup.

### Spacing scale
4px base. Use only these steps:

| Step | px | Use |
|---|---|---|
| `1` | 4 | icon-to-text inside chips |
| `2` | 8 | between buttons in a group, inside toolbars |
| `3` | 12 | **between panels**, page gutter |
| `3.5` | 14 | **panel padding** (x), row padding (x) |
| `4` | 16 | page header → content, between form fields in a grid (x) |
| `6` | 24 | empty-state padding, between page sections |

Control heights: **32px** in page headers and toolbars (`Button size="lg"`, `Input className="h-8"`),
**28px** inside panels and rows (`Button` default), **36px** for form inputs. Nothing interactive is under 28px.

### Page header — `PageHeader`
```
Title (Space Grotesk 24/700)                 [secondary] [Primary]
One-line subtitle (12px muted)
```
- Every page has one, and only one `<h1>`. The app header shows a breadcrumb (`❯ productivity / tasks`), not the title.
- At most **one primary** action; the rest are `outline`. Actions sit under the title on phones.
- `back` adds a small "← Projects" link above the title for detail pages. `badge` holds a `SourceBadge`.

### Settings modal
Settings is a modal (`features/settings/settings-modal.tsx`), opened from the gear at the bottom of the rail or
⌘,. Left: title, a search box and the sections (muted 16px icon and label; the active one is filled with
`--bw-selected`, a 2px ledge, a red icon and a 3px red marker on the left edge), with the build line pinned to the
bottom. Right: the section's heading and description over a divider, then its panels. Three surface layers keep it
legible: sidebar `--bw-well`, content pane `#12151C`, setting cards `#1A1F28` with 1px `--bw-border` hairlines and a
2px bottom ledge (no heavy page ledge, no scanlines). Searching shows the matching `SettingRow`s from every section.
Phones get the search and a section select above the content.

### Notes
Sticky notes use muted paper colours (low chroma, mid-light: plain `#BCC2CC`, yellow `#CFBB7C`, mint `#8EBDAF`,
pink `#C9A2B3`, blue `#9EAECB`) with `#14171C` ink, ≥ 8:1 on each.

### Learning (Productivity → Learning)
Navigation: Home · Productivity (Tasks, Projects, Learning, Calendar & daily log, Notes, Insights) · Development · CMS
(Pages & posts, Drafts, Media, Site analytics).

- **Overview:** a summary panel (in progress, due this week, overdue, % complete across active courses), course cards
  (3px colour bar on top, code chip, status, instructor and schedule, progress bar, next item) filtered by
  Active / Upcoming / Done / All, and a sticky **coursework $ upcoming** panel (overdue, next 7 days, the week after).
  "Add learning" is a menu so other kinds of learning can join Course later.
- **Course page:** coursework panel (To do / Done / All, quick-add that understands "fri"), course info with a
  progress block, and course notes (blue sticky notes, also on the Notes page).
- Coursework rows: checkbox, a type icon in a tinted square (assignment, exam, milestone, event), title, notes or
  course chip underneath, and the date/time on the right (amber when overdue).
- Course colours are label colours (blue, teal, green, amber, red, violet, slate), desaturated; never status colours.

### Panel
The §2 panel. Header is always the prompt `❯ tool $ command`, with meta and at most one small action group on the
right. Body padding `px-3.5 py-3`, or `divide-y` rows that carry their own padding. No `brutal` divs, no ad-hoc
`rounded-xl bg-card` boxes.

### Form field — `Field`
Label above the control (11px muted, sentence case), optional help under it (11px muted), error under that
(`#F08A8A`, linked with `aria-describedby`, input gets `aria-invalid`). Two-column grid on ≥ `sm` (`gap-x-4 gap-y-3.5`),
one column on phones. One primary button per form, bottom-left in a page form, bottom-right in dialogs; "Reset" or
"Cancel" is a quiet ghost next to it.

### Settings row — `SettingRow`
Title + one-line description on the left, the control on the right (stacked on phones). Rows are separated by
`divide-y divide-line` inside a panel.

### List row and table — `ListRow`, `DataTable`
- **ListRow:** 40px min height, `px-3.5`, 1px `--bw-line-soft` separator, `hover:bg-raised`. Leading marker or
  checkbox, title (truncates), trailing meta in mono 11px muted, trailing actions.
- **DataTable:** header cells are labels (10px caps faint); body 12px; rows 40px. Columns marked `optional` hide
  under `sm`, so tables never scroll sideways on a phone.

### Tabs
- `Tabs` (underline): switching between **views** of a page. Accent is a 2px red underline.
- `SegmentedTabs` (§2): **filters** inside a panel (Today / Next / Done, All / Posts / Pages).

### Toolbar
The first row inside a list panel: search well, filters, count on the right. `px-3.5 py-2`, `border-b`.

### Empty state — `EmptyState`
Inside the panel it belongs to: a muted 20px icon, one-line title, one-line hint and at most one action. A
"not connected" source uses `NoSignal` instead, so you can tell "nothing yet" from "no source".

### Status markers
6–8px squares: green healthy, amber degraded / overdue, red failed / attention, `--bw-faint` off or unknown.
