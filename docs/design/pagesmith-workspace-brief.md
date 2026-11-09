# Pagesmith workspace: brief for Builds 1 and 2

Owner-approved direction (Blake, Nov 9 2026). Read `AGENTS.md`, `docs/design/BLACKWALL_DESIGN.md` and `docs/design/pagesmith-review.md` first. This brief is the source of truth for the two builds below; where it is silent, decide and list it under **Choices I made**.

## Goal

Pagesmith should feel like one cohesive site editor (closer to Wix or the WordPress Site Editor in ease of use, not in size), and be linked to the rest of Blackwall where that helps. Today the work is spread over six tabs and an outline tree; the target is one screen where you see the site, click what you want to change, and change it.

## Approvals already given

- **New dependencies approved:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (drag to reorder), and shadcn's `resizable` component (adds `react-resizable-panels`) for the three panes. Check each is MIT, maintained, and pinned in the lock file. Any other new dependency still needs Blake.
- **UI kit:** stay on what the app already uses: Tailwind 4 + shadcn/ui (Radix) + lucide. Add more shadcn components with the shadcn CLI as needed (they're copied source, not new runtime deps beyond their Radix parts, which already ship in `radix-ui`). **No Bootstrap.**
- **PR size:** Blake prefers fewer, larger builds. Each build is one PR even if over 400 lines. Build 2 is stacked on Build 1 (say "Merge #N first" at the top).

## Hard rules for this work

- Workspace changes are additive and optional; add an older-shape fixture test for each new field (`tests/sitebuilder.test.ts`, `tests/workspace.test.ts`).
- Existing addresses keep working (`/cms`, `/cms/pages`, `/cms/posts`, `/assets`, the old tab routes). Redirect rather than remove.
- No automatic task completion anywhere. Linking only.
- Data honesty: no invented visits or connection states.
- Android is out of scope (Codex owns `mobile/`), but `npm --prefix mobile run check` must still pass after shared type changes.
- Never push to `main`, never merge your own PR.

## Build 1: the site workspace

Branch `claude/pagesmith-workspace` (this branch). One PR.

### Layout (web route and the Mac Website window)

The **Websites** overview stays as the landing page. **Edit** on a site opens the workspace:

- **Top bar:** site switcher, current page name, device width (desktop / tablet / phone), undo / redo, **View** (the existing walk-through), and toolbar buttons for **Look**, **Forms**, **Settings**, **Get files**. These open in the right pane (or a sheet when the window is narrow) instead of being separate pages. The old tab routes open the workspace with that panel showing.
- **Left pane (resizable):** two sections.
  - **Pages:** the site's pages, drag to reorder; drag right to nest under another page (that makes a drop-down menu); a menu toggle per page; New page (existing kinds and HTML paste); Posts listed below with New post.
  - **Layers:** the current page's sections and blocks as a tree, drag to reorder and to move into/out of rows and cards. Replaces the up/down arrows (keep keyboard move: Alt+↑/↓).
- **Center canvas:** the existing `SitePreview` iframe.
  - Hover outline and label on blocks; selected outline (already `.bw-sel`).
  - **Inline text editing** for heading, text, button and link labels: double-click (or click a selected block) makes it `contentEditable` inside the iframe (same-origin, no script needed in the frame); commit on blur/Enter to the block's field; Escape cancels. Rich text and lists keep editing in the inspector.
  - A "+" between sections opens the existing section gallery to insert at that spot.
  - Drag sections inside the canvas is nice-to-have; drag in Layers is required.
- **Right pane (resizable), the Inspector:** tabs **Content** (the existing `BlockField` fields), **Style** (new, optional per-block fields: alignment, spacing top/bottom, background tone; written as classes/CSS variables so old pages render unchanged), and **Links** (filled in Build 2; show "Linking comes next" placeholder text only if Build 2 is not in this PR). With nothing selected, the inspector shows page settings (title, address, description, in menu, footer menu).

### Menus

- `SitePage` gains optional `parentId` (one level of nesting is enough) and optional `inFooter`.
- The renderer outputs drop-down navigation that works without JavaScript (`:hover` and `:focus-within`, keyboard reachable) and a separate footer menu. Sites with no new fields render exactly as before.

### Editor behaviour

- Undo / redo (editor-local history of page/site edits, Cmd+Z / Shift+Cmd+Z). Keep revision checks on save.
- Shortcuts: Delete removes the selected block (with the existing Undo toast), Cmd+D duplicates, Esc deselects.
- Look panel keeps its live preview, but the preview is now the canvas itself.
- The setup checklist moves to a small "Set up your site" popover in the top bar (keeps its auto-ticking).

### Mac

- The Website window opens large by default (like Learning) and remembers its size. Assets keeps its own window; choosing a picture from the inspector still opens the library picker.

### Done when

`npm --prefix blackwall-admin run check`, `npm --prefix blackwall-admin test`, `desktop:test`, `npm --prefix mobile run check` and `repo_guard.py` pass, and you have driven the real Mac app: reorder pages and sections by dragging, nest a page into a drop-down, edit a heading inline, change a block's style, undo it, open Look/Forms/Settings/Get files from the top bar. Put screenshots of the workspace in the PR, side by side with the Wix editor or WordPress Site Editor layout it is modelled on.

## Build 2: links to the rest of Blackwall

Branch `claude/pagesmith-links` from Build 1. One PR.

- **Tasks and pages/posts:** `RecordLink.kind` gains `"page"` and `"post"` (additive). 
  - Task form / Planner inspector / Learning item: **Link a page or post** picker (site → page/post). Linked items show as chips that open the editor.
  - Page/post inspector **Links** tab: tasks linking to it (reverse lookup), each with due date, course and status, opening in Planner/Learning. **Link a task** from here too.
  - **Create page from this task** on a task (and on Learning assignments): pick a site and page kind (default Course portal / assignment page), prefill title, course and week, link both ways, open the new page.
  - Nothing marks a task complete when a page is published or downloaded.
- **Forms → notifications:** a new form submission or comment collected by the inbox creates a Blackwall notification (its own type in the existing per-notification settings, so Blake can choose bell / ntfy / email). Uses existing notify plumbing only.
- **Insights per site:** if an analytics source is mapped to a site's domain, show that site's visits/referrers/countries card in Insights and a small visits figure on its Websites card. If not mapped, say so; never show placeholder numbers.
- **Social:** a post gets **Share to Social**, creating a Social draft prefilled with title, summary, cover picture and the post's URL, for the accounts Blake picks. Adapt to whatever draft shape `src/features/social/` already has; if it has none, add an optional one.
- Same checks and real-app run as Build 1, including linking a task to a page both ways and creating a page from a task.

## Not in scope

Automatic task completion, Android screens, GitHub publishing of library pictures (decision still open on #99), RSS/tags pages, memberships.
