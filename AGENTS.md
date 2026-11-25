# AGENTS.md

Working rules for coding agents (Claude Code, Codex and others) in this repo. Read this before changing anything.

## What this is

Blackwall is Blake's personal admin dashboard (a.k.a. Mikoshi OS), shipped as three UIs that share one server:

- the **Mac app** (`blackwall-admin/desktop/` and `blackwall-admin/src/mac/`): **the primary UI and the one Blake uses**. An Electron app with its own windowed desktop workspace (a sidebar of apps, each in a window, plus a browser);
- the **Android app** (`mobile/`): an Expo WebView shell with a Settings Web/Native toggle; native screens are added over time;
- the hosted **web app** (`blackwall-admin/`): a backup.

All three talk to the same Node server and Postgres workspace. Layout and appearance choices are per browser/device.

## Where things live

- `blackwall-admin/src/`: React 19 + Vite + Tailwind 4 + Zustand web app. `src/features/` holds pages, `src/components/common|layout|ui/` the shared components.
- `blackwall-admin/src/mac/`: the Mac app's windowed desktop workspace. It shows the same pages from `src/features/` in its own windows.
- `blackwall-admin/server/`: the Node server (TypeScript run directly by Node 24), providers, storage, update check.
- `blackwall-admin/shared/`: types and validation used by both server and web (workspace records live here).
- `blackwall-admin/desktop/`: Electron main process, shell UI and its tests.
- `mobile/`: Expo SDK 58 app (`src/`, `modules/site-data/`, tests in `tests/`). Package `dev.bcndlabs.blackwall`.
- `docs/design/BLACKWALL_DESIGN.md`: the design rules. Read the sections for the area you touch. Reports from earlier phases sit beside it.
- `.github/agents/`: the Agents workflow scripts (see "Team and handoff"). Do not edit them in a feature PR.

## Commands

Each folder is its own project; run commands with `--prefix` (or `cd` first).

```bash
npm --prefix blackwall-admin ci --ignore-scripts      # install exactly what the lock file lists
npm --prefix blackwall-admin run check                # typecheck + lint + production build
npm --prefix blackwall-admin test                     # web + server tests
npm --prefix blackwall-admin run desktop:test         # Mac app tests
npm --prefix mobile ci --ignore-scripts
npm --prefix mobile run check                         # typecheck + tests
python3 .github/agents/repo_guard.py                  # keeps local-only files out of a change
```

Run the checks for every folder you changed, plus `repo_guard.py`, before you finish. The web `check` includes the build, so a green `check` means the app still builds.

## Team and handoff

Blake decides product questions and merges. Two builders work from GitHub issues:

- **Codex** works on `mobile/` (and any issue labeled `for:codex`). It runs on Blake's Mac, so the Mac must be on and awake.
- **Claude** works on `blackwall-admin/desktop/` and everything else (and any issue labeled `for:claude`). It runs on GitHub's machines.
- An issue without a `for:` label can go to either. A `for:codex` or `for:claude` issue is only taken by that builder.
- **Labels.** `ready` = has a brief and can be picked up. A "Depends on" section lists issues that must be closed first. `needs decision` and `paused` = leave it alone until Blake clears the label (a comment says why). `deferred` = not now.
- **Starting work.** Actions → Agents → Run workflow (also works from the GitHub mobile app): pick the agent, `next` (1 to 3 of the oldest `ready` issues) or a specific `issue`. One pull request per issue.
- **Builders don't stop to ask.** Small gaps in a brief are decided by the builder and listed under **Choices I made** in the pull request. If the job needs something from the "Ask Blake first" list, build everything else, then describe it under **Decision needed** (options A, B, C) and the workflow adds the `needs decision` label.
- **If a run can't finish** (nothing changed, the brief can't be met, or it touches CI, dependencies or deploy files): the issue gets a comment and the `needs decision` label, nothing is pushed, and the next issue still runs.
- **Review.** CI must be green and Blake merges. Builders never merge their own pull requests.
- **Blake's word wins.** If Blake names an issue, take it whatever its labels.

## Rules

**Data**
- Workspace changes are additive: new fields are optional, nothing is renamed or removed, and an older saved workspace must still load. Add a test that loads an older-shape fixture whenever you add a field (see `blackwall-admin/tests/workspace.test.ts` and `planner.test.ts`).
- Never silently lose or overwrite user data. Stale writes are rejected by revision checks; keep that behavior.
- Data honesty: never fabricate totals, charts or connection states. Sample data is labeled as sample data.

**Mac first**
- Build and finish new features and UI changes in the Mac app's windowed workspace. The web app and the Mac's Classic view are backups: do their web-only work after Blake has tested the Mac version and calls it final. Never point Blake to either as the way to use a feature.
- A new section is not done until it has a sidebar icon (or a tab in an app) and a window in `src/mac/desktop-workspace.tsx`, a path in `src/mac/app-for-path.ts`, and its show/hide switch in Settings. Adding it to the web sidebar alone does not reach the Mac app.
- Blake tests with Settings → About → Update from source, which builds the app from the local checkout.

**Design**
- Follow `docs/design/BLACKWALL_DESIGN.md`. Reuse the shared components in `src/components/common|layout|ui/` instead of adding page-specific widths, footers, inputs or radii.
- Never change the responsive layout to suit the mobile view; the mobile view and native screens adapt to the shared data, not the other way around.
- Layout and appearance choices stay per browser (preferences), not in the shared workspace.
- Do not touch the owner-approved Planner geometry unless the issue says so.

**Native apps**
- Native pages call the server API only; they must not read or write the database or copy business logic. Shared rules (validation, dates, merging) live in `blackwall-admin/shared/` and are imported, not re-implemented.
- Every native screen has a Web fallback; the user can always switch back to the web view.
- Keep secrets out of the repo. Android and Mac builds are signed with the owner's local keys, never committed.

**Reuse before building**
- Prefer an existing, maintained library over writing it from scratch, and propose it to Blake; new dependencies need approval.
- Only use code under permissive licenses (MIT, Apache-2.0, BSD, ISC). Never copy code from GPL, AGPL or source-available non-compete projects.

**Ask Blake first**
- New dependencies (any `package.json` or lock file change), changes to CI, the Dockerfile or `deploy/`.
- Changes to how the server stores data or authenticates, or anything that talks to a new network service.
- Android permissions or the app id, and anything that changes how an app signs or updates itself.

**Keep local-only things out of the repo**
- Never commit build output, caches, keys or machine files: `build/`, `.gradle/`, `node_modules/`, `.expo/`, `dist/`, `*.apk`, `*.aab`, `*.keystore`, `*.jks`, `local.properties`, `.env` files.
- Never put a home-directory path (`/Users/<name>/`) or a real Tailscale host name (`*.ts.net`) in a file. Use `blackwall.example.ts.net` as the placeholder.
- `python3 .github/agents/repo_guard.py` checks all of this; it must pass.

**Workflow**
- One small pull request into `main` per piece of work (roughly under 400 changed lines, lock files aside). `main` is protected: never push to it directly.
- Link the issue: `Closes #N` (or `Part of #N`). Branches from the Agents button are `claude/issue-N` and `codex/issue-N`.
- Commit prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`, `ci:`.
- Commit messages are technical: what changed in the code and why.
- Pull request descriptions are lean and written for a non-developer: what changed for the app, in plain words; **Choices I made** or **Decision needed** only if there are any; then **Tested** and **Not tested**, honestly. Don't restate the brief.
- Agent-built commits and pull requests carry no `Co-Authored-By` trailers, session links or "Generated with" footers; the workflow commits them as the repo owner.
