# Blackwall — Design Spec (v1, "Home C")

Source of truth for the Blackwall dashboard look and behavior. The mockup source is
`reference/home-c.dc.html` (read as source; it needs the design tool's runtime to render). All data in it is sample data. Match the look; don't copy its
markup format, and treat everything in it as sample data.

---

## 1. Design tokens

### Color
| Token | Value | Use |
|---|---|---|
| `--bw-ground` | `#0A0D13` | App background |
| `--bw-grid` | `rgba(120,160,190,.06)` | 24px background grid lines |
| `--bw-panel` | `#161719` | Panel surface |
| `--bw-raised` | `#1C1D20` | Cards inside panels, hover rows, flyouts |
| `--bw-selected` | `#202125` | Selected tab / active row fill |
| `--bw-well` | `#0F1012` | Inputs, chart wells, meters |
| `--bw-ledge` | `#2A2C30` | Panel ledge (right + bottom edge) |
| `--bw-ledge-hi` | `#2E3035` | Floating card / selected item ledge |
| `--bw-line` | `#26282C` | Dividers inside panels |
| `--bw-line-soft` | `#1E1F22` | Row separators |
| `--bw-border` | `#2A2C31` | 1px borders on wells, chips, ghost buttons |
| `--bw-red` | `#BC1515` | **The only accent.** Fills, markers, icons, primary buttons |
| `--bw-red-ledge` | `#6E0C0C` | Ledge under red fills |
| `--bw-amber` | `#E0A526` | Degraded / overdue / deadline |
| `--bw-green` | `#5EF0B5` | Healthy deltas and passing checks only |
| `--bw-text` | `#EDEFF2` | Primary text |
| `--bw-text-2` | `#C9CDD3` | Secondary text |
| `--bw-muted` | `#9499A3` | Labels, meta |
| `--bw-faint` | `#7C818B` | Smallest labels (lowest allowed for text) |
| `--bw-off` | `#2C2E33` | Unlit meter segments |

Rules:
- `#BC1515` is **never** used for small text (fails contrast on charcoal). Use it for fills, squares, bars, icons, and the `❯` prompt glyph. Text on red is white.
- No glows, gradients or colored panel outlines. Depth comes from the ledge, not shadow (floating cards are the one exception, below).
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

### Left rail (hover-extend)
- 40×40 icon buttons. Active page = red fill.
- On hover or keyboard focus, **the button itself** grows into one continuous pill (≈220px wide, 200ms): label + status hint fade/slide in, and subpages unfold beneath (grid-rows 0fr→1fr, 220ms). It floats over content (z-index above main) and never reflows the page.
- **Known bug to fix:** the expanded pill covers the icon buttons below it, so you can't move straight from one button to the next. Fix: keep the **icon column (x 0–44px) uncovered**. The subpage list starts at x≈44px under the label (an inverted-L shape that still reads as one piece), or open the subpages to the right of the head row. Collapse instantly when the pointer enters another rail icon.

### Calendar (header, top-right)
- Collapsed by default to a small "📅 Oct 30" ghost button (use a line icon, not an emoji).
- Click opens a dropdown card (fade + 6px drop, 180–220ms) with a month grid and today's agenda. "hide" collapses it.
- Clicking a day opens the **log** dialog for that date (day's events, quick chips: shipped / learned / blocked on / tomorrow, textarea, Save). The log is not on the home page itself.

### Notifications (floating right card)
- Bell button in the header with an unread badge toggles it. It slides in from the right (translateX, 280ms) **over** the panels, with no dimming and no layout shift. Hidden by default.
- Filters: All / Alerts / Dev / Site. Grouped Today / Yesterday. Unread = bold title + red square; click marks read; "read all".

### Auto-hide (calendar + notifications)
- When the pointer leaves the open card, start a 5s timer (configurable). Show a 2px red bar across the top of the card that drains over that time. Re-entering cancels. When the timer ends, close.

---

## 5. Accessibility
- Real `<button>`/`<a>`/`<input>` elements; icon-only buttons get `aria-label`.
- Rail flyouts open on `:focus-within` as well as hover.
- Tabs use `role="tablist"`/`tab` + `aria-selected`; toggles use `aria-expanded`/`aria-pressed`.
- Respect `prefers-reduced-motion` (drop slide/clip transitions to instant).
- Text contrast ≥ 4.5:1: never use `#BC1515` or anything darker than `#7C818B` for text.

## 6. Open decision
Red means "brand / healthy service" in status meters but also "failed" in GitHub checks and alerts. Pick one meaning before the build hardens. Suggestion: red = brand + attention (alerts, failures); healthy = neutral light grey or green.
