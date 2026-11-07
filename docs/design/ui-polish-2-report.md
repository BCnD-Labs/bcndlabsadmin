# UI polish 2 report (branch `ui-polish-2`, Nov 2026)

This pass covers three things:
- the leftovers from the first polish report,
- type chips, filters and optional panels for Learning,
- a single-open sidebar, with Learning as its own section.

Nothing changed in the server, the API, the schema or workspace records. `mobile/` and `desktop/` were not touched, and neither were the mobile shell's layout and `MOBILE_PAGES`. The mobile shell only gets its nav data from `useNav`, as before. No build output is committed. No dependencies were added.

Screenshots are in `docs/design/reference/ui-polish-2/before/` and `after/`, named `<page>-<width>.png`, at 390, 820 and 1440 px. They were taken with headless Chromium against a throwaway copy of the app. That copy ran its own dev server and its own `.blackwall/` workspace, filled with made-up records:
- two courses, "Data Structures" (all four item types) and "Intro to Statistics",
- a few Planner tasks with 23:55 and 23:59 due times,
- for the `*-with-certification` shots, one sample certification.

Settings → Sample data was on. No real hostnames or personal data appear.

| Screenshot | Shows |
| --- | --- |
| `posts-*` | Part 1 A: header tabs on Posts & pages |
| `planner-week-*` | Part 1 B: Week view, scrolled to the evening |
| `course-*` | Course page with the panels off (before = `main`) |
| `course-panels-on-*` | Course page with all four type panels on (after only) |
| `learning-*` | Learning index |
| `sidebar-1440` | Expanded sidebar on a Learning page: Learning open, Productivity collapsed |
| `sidebar-with-certification-1440` | After adding a sample certification: Overview + Courses + Certifications |
| `navsheet-390`, `navsheet-with-certification-390` | The 390px phone navigation sheet |

## Part 1: leftovers

| Commit | Item | What changed |
| --- | --- | --- |
| 95c4e14 | A. Header tabs at ~820px | The header measures the tabs against the title column beside the actions. When they fit, nothing changes: they sit under the title, and wide layouts are identical (header height at 1280 and 1440 is unchanged: 70px, 72px on course pages). When they don't fit, they move to their own full-width row below the title and actions and wrap instead of scrolling. Phones always use the row. That was the fix for Posts & pages at 820, a course page at 820, and several pages with the full sidebar open at 768–1024. |
| d68a791 | B. End-of-day items in Week/Day | Items whose only time is a legacy due time from 23:45 on (with no `scheduledDate`) now show in the All-day / Due row as "Due: …". This matches the month rule. Scheduled slots (even at 23:55) and real due times stay in the timed grid. New `isTimedOn` / `isAllDayOn` helpers drive both the row and `timedLanes`. It's a display change only; stored times are untouched. There is a new test in `tests/planner.test.ts`. |
| 3b194e4 | D. Unused calendar | `git grep` for `PlannerCalendar`, `CalendarSelectors` and the `planner-calendar` module found no imports anywhere, tests included. The file is deleted. The `.planner-calendar` CSS class stays because `ScheduleCalendar` uses it. |

For A, I checked every page with header tabs: Productivity (Planner, Projects, Insights, a course page), Learning, Website (Pages, Posts), Mikoshi. Each was checked with the rail and with the full sidebar at 390, 768, 820, 1024, 1280 and 1440. No label was cut off, nothing scrolled sideways, and the page never scrolled horizontally. On `main`, Posts at 390 cut "Site settings" off as well; it now wraps to a second line.

Skipped on purpose, as asked:
- Planner's 12px panel gap (owner-approved density).
- Toolbar rows that hold only a count.
- Row-mates sharing height (documented grid behavior).

## Part 2: Learning

| Commit | Step | What changed |
| --- | --- | --- |
| 5acd0ac | 1. Type chip | Every `CourseworkRow` now shows a 20px tonal chip (icon + label from `learningType()`) instead of the neutral 28px tile. Kind names show correctly ("Exam domain", "Practice test", "Chapter", "Study task"). Each type has a tint token in theme.css: Assignment blue, Exam violet, Milestone cyan, Event neutral. Events also get a secondary title color, so they read lighter, and keep their checkbox. Chips sit in a fixed slot so titles line up. A container query makes the chip icon-only in rows under ~380px wide, with the label kept as accessible name and tooltip. Category colors off makes the chips neutral. |
| eb12b0c | 2. Filters + grouping | Under To do / Done / All there are type filter chips: All, then the kind's types with kind plurals. Any other type that items still use is appended, so nothing becomes unreachable after a kind change. The counts follow the current tab. A "Group by: When \| Type" toggle defaults to When. Type grouping uses the kind's labels and order, and the sort inside groups is unchanged. Also fixed in the shared `FilterChips`: the fixed `h-7` becomes `--bw-control-sm`, counts are AA on the selected fill, and there are optional `wrap` and All count props. |
| 2966223 | 3. Per-type panels | A "Panels" popover in the Coursework toolbar has a Switch per type the kind uses (with the type chip). I put it there rather than in the header, which already holds the page's one red button plus Edit. Each switch adds a card after Coursework, stacked in one narrow grid column, which stacks on phones. The card has the kind's plural as title, open/done count, a progress bar from `courseProgress(items, type)` (none for events), the items by date with the next one emphasized, a quick add for that type, and an "Add with details" `PanelFooter`. Items stay in the main list. Default all off, so the screen is unchanged until you switch one on. |

The type tints and their contrast on the chip over the panel / over the hovered row:

| Type | Dim | Dark |
| --- | --- | --- |
| Assignment | `#9cc4f2` (5.2 / 4.6:1) | `#8ab4f8` (6.1 / 5.6:1) |
| Exam | `#cbb5ff` (5.2 / 4.6:1) | `#c58af9` (5.3 / 4.9:1) |
| Milestone | `#5fd0e6` (5.3 / 4.7:1) | `#4ecde6` (6.7 / 6.1:1) |
| Event | `--bw-muted` on a 10% fill (5.1 / 4.5:1) | `--bw-muted` (6.4 / 5.8:1) |

Panel persistence uses prefs `coursePanels` (course id → types), per browser, following the Home layout pattern. The helpers are in `src/lib/course-panels.ts`:
- `normalizeCoursePanels` runs on every load: wrong shapes, unknown types, duplicates, empty lists, oversized or prototype keys, and more than 200 courses all fall back safely.
- `coursePanelsFor` only returns types the course's kind uses.
- `toggleCoursePanel` drops entries for deleted courses whenever you toggle.

No version bump was needed for this field, because the store's `merge` sanitizes it.

Two smaller row changes:
- In narrow rows the time drops under the date ("Tomorrow" / "11:55 PM"), so titles keep their room. This helps the Learning page's Upcoming list and Home's coursework rows at 390 too.
- A type panel marks its next item with an accent edge, a bold title and "Next up" for screen readers. A visible "Next" pill was squeezing titles in narrow cards.

The pure helpers are in `src/features/learning/coursework-view.ts`: type tint map, `viewItems`, `typeCounts`, `typeOptions`, `courseworkGroups`, `nextItem`, `addDaysKey`. `compareCoursework` moved there and is re-exported. Tests are in `tests/learning.test.ts`.

## Part 3: sidebar accordion and Learning as its own section

| Commit | Item | What changed |
| --- | --- | --- |
| 3193f74 | 3a. Accordion | `NavTree` keeps one `openId` (string \| null) instead of a set. Opening a section closes the other; clicking the open header closes it, so all can be closed. Navigating into a section opens it and closes the previous one. ←/→, `aria-expanded`/`aria-controls`, the animation and reduced motion are unchanged. The collapsed rail's hover behavior is untouched. |
| 71930b7 | 3b. Learning section | NAV has a top-level `learning` destination (learning category/icon) and Productivity no longer lists Learning. The route stays `/productivity/learning`. `activeDestination` picks the most specific match, so Learning's pages highlight Learning everywhere: rail, tree, header tabs, phone sheet, tab bar. Sub-pages are only marked current inside the active section; Planner used to light up on Learning routes. `useNav` derives Learning's children from your records (Courses always, other kinds once they exist, Overview first with 2+ kinds). Every surface reads it: sidebar, rail pop-outs, header tabs, command search ("Learning › Certifications"), quick create (named like the section), the phone sheet and nav-hints counts. The Learning page reads `?kind=` and keeps it in sync when its tabs change; invalid values are All. When a kind is asked for, the page picks a status filter that contains it. Settings → Sidebar renames/hides Learning and explains its pages. Prefs v7 migration starts Learning visible under its own name and keeps every other saved name and hidden section. |

The pure helpers (`learningChildren`, `activeDestination`, `matchesRoute`, `kindFromSearch`) are in `src/components/layout/nav-model.ts`, with tests in `tests/nav.test.ts`. That's step 3c; the tests shipped in the 3b commit, because they cover exactly that code.

## What I verified and what I didn't

Verified:
- `npm run check` passes (typecheck, oxlint, build). There are 8 oxlint warnings, the same 8 as on `main`, none of them in files this branch touches.
- `node --test tests/*.test.ts`: 54 pass, 0 fail, 1 skipped (the Postgres test needs `TEST_DATABASE_URL`). That includes 12 new Learning tests, 3 new nav tests and 1 new Planner test.
- In headless Chromium against the sample workspace:
  - **Header tabs:** measured on every page with header tabs at six widths, with the rail and with the full sidebar. No cut-off labels, no sideways scroll, no page overflow, and the 1280/1440 header height is the same as on `main`.
  - **Coursework filters:** the type chips filter, combine and follow the tab ("Done" counts: All 3, Assignments 1, Exams 1, Milestones 1, Events 0). Type grouping uses the kind's labels.
  - **Type panels:**
    - They turn on and off and survive a reload.
    - A malformed stored value shows no panels.
    - A stale course id is pruned on the next toggle, while a live course's entry is kept.
    - The per-type quick add creates that type, and it becomes the "Next up" item.
  - **Sidebar:**
    - On a course page only Learning is open and nothing in Productivity is marked current.
    - Clicking Productivity opens it and closes Learning; clicking it again closes everything.
    - → and ← open and close.
    - The Courses child goes to `?kind=course` and selects the Courses tab; the All tab clears `?kind`; `?kind=bogus` shows All.
    - The rail pop-out lists Learning's children with counts.
    - Command search finds "Learning › Courses".
  - **Sample certification:** with one added, Overview, Courses and Certifications appear (sidebar and header tabs), with Certifications current on `?kind=certification`.
  - **Old prefs:** v6 prefs with Productivity hidden and renamed, plus a stray `learning` hide/label, migrate to v7 with Learning visible and Productivity's choices kept. Renaming Learning in Settings → Sidebar renames the section, and hiding it removes it.
- A `git grep` for local home-directory paths finds nothing. The real tailnet name appears nowhere; the only `.ts.net` names are the existing test and docs placeholders (`*.example.ts.net`, `tail1234`, `your-tailnet`), none added by this branch.

Not verified:
- **Dark theme screenshots.** Only Dim was captured. The Dark tints were checked numerically (table above), not visually.
- **Real touch devices, Safari and Firefox.** Container queries and `color-mix` are supported in current versions of all three, but I didn't run them.
- **Home's "Assignments & exams" block.** It's hidden by default and wasn't screenshotted. It uses the same `CourseworkRow`, so the chip and narrow-row behavior are the same as on the Learning page's Upcoming list, which was checked at 390.
- **The phone bottom tab bar (mobile view) in a browser.** I checked its code path only.

## Dependencies

None added. Screenshots and browser checks used a `playwright-core@1.56.1` install already in a scratch folder outside the repo, with Playwright's cached Chromium.

## Needs a decision

1. **Phone tab bar order.** The mobile view's bottom tab bar shows the first four sidebar sections. With Learning now a section, those are Home, Productivity, Learning, GitHub activity, and Website moves under More. I left the order (Learning sits right after Productivity, where it used to be a child). Move Learning lower in NAV, or let the tab bar pick its own four?
2. **Overview with only one non-course kind.** Overview appears only when records of two or more kinds exist, as specified. A workspace with only a certification therefore shows "Courses" (empty) and "Certifications" with no Overview. The unfiltered page is still the Learning section link and the page's All tab. Should Overview appear whenever two children show?
3. **Course detail in the Learning tree.** On a course page, Overview is marked current when it exists (prefix match). When only Courses exists, no child is marked. Highlighting the course's own kind would need the course record in the nav.
4. **Type panels placement.** All type cards stack in one narrow column right after Coursework, so they keep their own heights instead of stretching to Coursework's. On wide screens this pushes Notes to the next row. Separate grid items would keep Notes up but leave tall empty cards.
5. **No Settings entry for course panels.** The popover on each course page is the only control; there's no "reset all course panels" in Settings → Home. Add one?
6. **Panels control location.** It's in the Coursework toolbar, not the page header, so the header keeps one red button plus Edit. Say if you'd rather have it in the header.
7. **Learning page title on rename.** Renaming the Learning section in Settings → Sidebar renames the sidebar row, header tabs, search and quick create, but the page's own title stays "Learning". That's how other sections behave too.
8. **Phones: header tabs wrap.** At 390, pages with many tabs (Website) now show two rows of tabs instead of a sideways-scrolling row with a cut-off label. That's one extra 32px row there.
