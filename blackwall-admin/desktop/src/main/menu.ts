import { Menu, app, type MenuItemConstructorOptions } from "electron"

export interface MenuActions {
  newTab(): void
  closeTab(): void
  closeWindow(): void
  focusAddress(): void
  webAddress(): void
  find(): void
  findNext(forward: boolean): void
  reload(ignoreCache: boolean): void
  back(): void
  forward(): void
  home(): void
  zoom(delta: 1 | -1 | 0): void
  devTools(): void
  nextTab(): void
  previousTab(): void
}

/**
 * The native menu bar. Shortcuts live here so they work whichever view has
 * focus (chrome or a web page). Cmd+1…9 are handled in before-input-event.
 */
export function buildMenu(a: MenuActions): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "Web Address…", click: a.webAddress },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "New Browser Tab", accelerator: "CmdOrCtrl+T", click: a.newTab },
        { label: "Open Location…", accelerator: "CmdOrCtrl+L", click: a.focusAddress },
        { type: "separator" },
        { label: "Close Tab", accelerator: "CmdOrCtrl+W", click: a.closeTab },
        { label: "Close Window", accelerator: "CmdOrCtrl+Shift+W", click: a.closeWindow },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
        { type: "separator" },
        { label: "Find…", accelerator: "CmdOrCtrl+F", click: a.find },
        { label: "Find Next", accelerator: "CmdOrCtrl+G", click: () => a.findNext(true) },
        { label: "Find Previous", accelerator: "CmdOrCtrl+Shift+G", click: () => a.findNext(false) },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload Page", accelerator: "CmdOrCtrl+R", click: () => a.reload(false) },
        { label: "Reload Ignoring Cache", accelerator: "CmdOrCtrl+Shift+R", click: () => a.reload(true) },
        { type: "separator" },
        { label: "Actual Size", accelerator: "CmdOrCtrl+0", click: () => a.zoom(0) },
        { label: "Zoom In", accelerator: "CmdOrCtrl+=", click: () => a.zoom(1) },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: () => a.zoom(-1) },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        { label: "Developer Tools", accelerator: "Alt+CmdOrCtrl+I", click: a.devTools },
      ],
    },
    {
      label: "History",
      submenu: [
        { label: "Back", accelerator: "CmdOrCtrl+[", click: a.back },
        { label: "Forward", accelerator: "CmdOrCtrl+]", click: a.forward },
        { type: "separator" },
        { label: "Blackwall Home", accelerator: "CmdOrCtrl+Shift+H", click: a.home },
      ],
    },
    {
      role: "windowMenu",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { label: "Show Next Tab", accelerator: "CmdOrCtrl+Shift+]", click: a.nextTab },
        { label: "Show Previous Tab", accelerator: "CmdOrCtrl+Shift+[", click: a.previousTab },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ]
  return Menu.buildFromTemplate(template)
}
