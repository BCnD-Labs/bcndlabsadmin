// Copies the chrome UI's HTML/CSS and the app icons next to the compiled code in desktop/out/.
import { cpSync, mkdirSync } from "node:fs"
import path from "node:path"

const desktop = path.join(import.meta.dirname, "..")
const icons = path.join(desktop, "..", "public", "icons")
const out = path.join(desktop, "out")

mkdirSync(path.join(out, "chrome"), { recursive: true })
mkdirSync(path.join(out, "icons"), { recursive: true })
cpSync(path.join(desktop, "static"), path.join(out, "chrome"), { recursive: true })
cpSync(path.join(icons, "icon-192.png"), path.join(out, "chrome", "bw-icon.png"))
cpSync(path.join(icons, "icon-512.png"), path.join(out, "icons", "icon-512.png"))
console.log("[desktop] static files copied to desktop/out")
