# UI polish report (branch `ui-polish`, Nov 2026)

These are visual and layout fixes only. Nothing changed in behaviour, data, the API or the schema. `mobile/`, `desktop/`, the mobile shell and `MOBILE_PAGES` were not touched. The owner-approved Planner layout stays as it was: the wide calendar above Notes and Daily log, the inspector on the right, Day/Week/Month views, and all-day deadlines in their own row.

Screenshots are in `docs/design/reference/ui-polish/before/` and `after/` (`<page>-<width>.png` at 390, 820 and 1440 px). They also include `after/planner-narrow-agenda-390.png`. They were taken with headless Chromium against a throwaway workspace of made-up sample tasks, notes and a course, with Settings → Sample data turned on. No real hostnames or personal data appear in them.

## Stage 1: Planner calendar (commit e8c0e6b)

**How end-of-day deadlines are stored (checked without changing any data).** No code sets a default 23:55. Those items are legacy tasks with `due` plus `time: "23:55"`: the user typed the time into the task form's Time field next to the due date. A scheduled slot (`scheduledDate` + `scheduledTime`) is separate and never changes the deadline.

**The rule now:** a calendar item shows a start time only when it has a real one:
- a scheduled time, or
- a due-date time before 23:45.

Due-date times from 23:45 onward (23:55, 23:59) count as "end of day". They show as a deadline: a small flag icon, with "Due:" for screen readers.

| Problem | Fix |
| --- | --- |
| Month chips wrapped over 2–4 lines and broke mid-word | One line with an ellipsis. The full title (and due date and time) is in the tooltip. Clicking still opens the inspector. |
| "23:55" shown as a time prefix | Removed for end-of-day deadlines, as described above. The week view's All-day / Due row keeps its "Due:" wording. |
| Too many chips per day | Up to 3 chips. With more, it shows 2 chips and "+N more", which opens that day in Day view (the existing behaviour). |
| Month grid scrolled inside the panel (`max-height: 440px`) | The month now shows every week at natural height, 4–6 rows instead of a fixed 6. Cells are compact (68px minimum). |
| "+" in every cell | Shows on hover or keyboard focus on pointer devices. On touch it shows only on the selected day, at 32px. It is still reachable with the keyboard. |
| Today and selected states were hard to tell apart | Today has a red ring on the date. The selected day has a red date pill on the selected background, the same as the header calendar. Week-view headers match. |
| "Log" marker didn't match the chips | It is now a quiet chip (same height, radius and type) on the date row, e.g. `Log · ✓1`. |
| Narrow widths (Planner under 560px) | Cells show the date plus up to 3 dots (blue open, amber overdue, green done, then +N). Tapping a day selects it and lists its items under the grid, using the same item component, with an add button. Chips are hidden. Wide layouts are unchanged apart from the fixes above. |

There are new pure helpers in `planner-utils.ts`: `isEndOfDay`, `startTimeOn`, `isDeadlineOn`, `chipOverflow` and `dayDots`. They have unit tests in `tests/planner.test.ts`.

## Stage 2: consistency across the app

The pages were audited at 390, 820 and 1440 px: Home, Planner (Notes is part of it), Projects, Learning, Activity insights, Mikoshi, Website/CMS (Pages, Posts), Social, Website traffic (Analytics), GitHub activity (Development) and Settings. The audit combined screenshots with a script that measured tap targets under 32px on touch layouts, horizontal overflow, control heights outside 28/32/40px, and panel radii.

| Commit | Area | What changed |
| --- | --- | --- |
| 53f229c | Home (shared component) | There were four different panel-footer versions: 14–20px insets, 11–13px text, inset or full-width rules, and 20px tap targets on phones. They are now one `PanelFooter` (`.bw-panel-footer`): a 36px row at the panel inset with a 13px `bw-action-link` (32px target) and an arrow icon. Used by Pull requests, This week, Repositories, GitHub/Website/Traffic/Log mini panels, Coursework, Projects and Linked services. The 22px "+" in Tasks & notes is now the standard quiet `icon-sm` button. |
| 647493c | Controls (Posts, Mikoshi launcher and storage, Planner notes, Social post, Course detail, doc links) | Search and filter inputs use the 6px control radius instead of 7px. The borderless ones (`outline-none` with no visible focus) now have the control border and a focus ring. Fixed 28px inputs and doc-link chips use `--bw-control-sm`, so they reach 32px on touch. |
| a29b8cf | Planner | With nothing selected, the "Selected task" inspector sizes to its hint instead of stretching the full canvas height. A selected task keeps the full-height column. The Daily log starts at about 4 lines (it was a fixed 160px) and grows as you type (`field-sizing: content`, capped at 60vh, still resizable), so the Notes card beside it has much less empty space. The focus strip and textareas use the radius tokens. |
| 2287d12 | Learning | The kind filter stretched each tab across the toolbar (two tabs about 450px wide each). It is now content-width, like Projects. Coursework titles (Upcoming, Home coursework, course detail) wrap to two lines on word boundaries instead of being cut to a few characters. |

Pages audited with nothing to fix: Projects, Activity insights, Social, Website traffic, GitHub activity and Settings were already consistent on control heights, panel title bars, radii (16px panels) and phone tap targets. Their screenshots are not in the reference folder because they did not change.

## What I verified and what I didn't

Verified:
- `npm run check` passes (typecheck, oxlint, build). There are 8 oxlint warnings, the same 8 as on `main`.
- `node --test tests/*.test.ts`: 38 pass, 0 fail, 1 skipped (the Postgres test needs `TEST_DATABASE_URL`).
- In a real browser at 390 and 1440 px:
  - Tapping a day on narrow Month shows that day's agenda, and tapping an agenda item selects the task.
  - The add button is hidden when idle and appears on hover and on keyboard focus.
  - Arrow keys still move the selected day and keep focus.
  - "+N more" opens Day view.
  - Chips are 20px tall, one line, with a full-title tooltip.
- After the changes, the tap-target audit at 390 px finds nothing under 32px except Home's "New task" text input (20px). Its wrapping label is 32px and focuses the input when tapped, so the real tap area is 32px.
- A `git grep` for local home-directory paths and a search for the real tailnet name both come back clean (only `*.example.ts.net` placeholders exist).

Not verified:
- Dark theme screenshots. Everything uses tokens and only Dim was captured.
- Real touch devices. Touch was simulated: `hasTouch` and `(hover: none)` are emulated by headless Chromium only partly.
- Safari and Firefox. `field-sizing: content` works in Chromium and Electron. Browsers without it get a 104px resizable textarea.
- Mikoshi Storage, a Social post page and Course detail. They need connections or records the sample workspace doesn't have, so those small control changes were checked in code only.
- The week view still places a 23:55 legacy deadline at the bottom of the timed grid (see below).

## Dependencies

None added. Screenshots used a throwaway `playwright-core@1.56.1` install in a scratch folder, outside the repo, with Playwright's already-cached Chromium.

## Contradictions between the design doc and the tokens

What `theme.css` actually does was followed. The doc text was not rewritten.

- **Panel radius:** the doc says "16px panel radius" in the Current direction note, but "Panels have 8px corners … panels 8px" under Typography, shape and density. `--bw-panel-radius` is `1rem` (16px).
- **Panel gaps:** the doc says "24px between panels" in one place and "Keep 12px panel gaps" / "12px gaps" (Workspace grid) in others. `--bw-grid-gap` is `1.5rem` (24px), and 12px in Compact density.
- **Panel insets:** the doc says "~20px inside" in one place and "12–14px content insets" in another. `--bw-panel-pad` is `1rem` (16px).
- **Planner gap:** the doc's older Planner section says "16px gap". `planner.css` uses 12px between Planner panels, not `--bw-grid-gap` (see Needs a decision).

## Needs a decision

1. **Planner panel gap.** Planner uses 12px between the focus strip, calendar, notes, log and inspector. Every other page uses `--bw-grid-gap` (24px). Switching to the token would loosen the owner-approved Planner density, so it was left as is.
2. **Header section tabs at about 820px.** On pages with a title badge and a primary action (e.g. Posts & pages), the section tabs in the header scroll sideways with no visible scrollbar, and the last tab is cut off ("Site se…"). Fixing it needs a header layout choice: wrap the tabs, fade the edge, or move actions earlier.
3. **End-of-day items in Week/Day view.** Legacy 23:55 deadlines still sit in the timed grid at 23:55, at the very bottom, partly below the last hour line. Showing them in the All-day / Due row instead would match the month rule, but it changes where items appear in Week view.
4. **Toolbar rows that hold only a count.** Several panels (Insights "2 total", Open work "17", Top pages "views", Linked services "0 linked") have a full 36px toolbar row holding only a right-aligned number. That follows the current title-bar rule ("everything else goes in the row below"). Folding counts into the title bar would change that rule.
5. **Row-mates share height.** Social → Accounts and similar side panels stretch to the height of their row-mate, leaving empty space. This is the documented grid behaviour ("cards in the same row share the tallest card's height"). Making them content-sized would change it.
6. **Unused `PlannerCalendar` / `CalendarSelectors`** (`planner-calendar.tsx`). Nothing imports them. They were left alone. Delete them, or keep them for later?
