# Mac workspace shell

The Mac app is the tool itself; the browser is a separate, on-demand feature. The workspace window is laid out like a classic desktop mail client, in the current dark, flat language:

```
┌ title bar: [sidebar] page · search · page actions · [browser][tools][settings] ┐
├──────────┬───────────────────────────────────────┬────────────────────────────┤
│ left     │  page                                 │ Tool Dock (right)          │
│ navigation│                                       │  Calendar / Tasks / Log …  │
│ only     │                                       │  tools only                │
├──────────┴───────────────────────────────────────┴────────────────────────────┤
│ status bar: sync · where you are · date                                       │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Title bar.** Drawn by the workspace (as in VS Code), so the page toolbar and search sit inline with the window buttons. The File/Edit/View menus live in the Mac's own menu bar, not here. The page leaves 82px for the traffic lights unless the window is full screen (or a browser tab strip sits above it); the main process tells the page which (`data-chrome`, `data-fullscreen` on `<html>`).
- **Left sidebar: navigation only.** The folder tree. `⌘B` hides it.
- **Right Tool Dock: tools only.** Each tool is a small window with its own title bar: collapse, move up/down, remove. "Add tool" puts one back. Width, order, collapsed state and visibility are saved per Mac (browser storage, never the shared workspace). `⌥⌘B` hides it. First tools: Calendar, Tasks, Daily log, Notes, all reading the same workspace data as the full Planner page, which stays in the navigation for the big calendar. Calendar, Tasks and Daily log follow one shared chosen day.
- **Status bar.** Sync state, current location and date.
- **Browser.** The globe button (or `⌘T`) opens a browser tab; the tab strip appears above the workspace only while browser tabs exist. See `desktop/src/main/tabs.ts` (`chromeMode`).

New dock tools go in `src/mac/dock/tools.tsx` and `dock-layout.ts`. Pages are still the shared feature pages; Mac-specific screens replace them one area at a time (Pagesmith, then Mikoshi).
