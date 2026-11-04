// Copies the chrome UI's HTML/CSS and the app icons next to the compiled code in desktop/out/.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"

const desktop = path.join(import.meta.dirname, "..")
const icons = path.join(desktop, "..", "public", "icons")
const out = path.join(desktop, "out")
const native = path.join(desktop, "..", "dist")

if (!existsSync(path.join(native, "index.html"))) throw new Error("Build the Blackwall UI before compiling the Mac app")

mkdirSync(path.join(out, "chrome"), { recursive: true })
mkdirSync(path.join(out, "icons"), { recursive: true })
cpSync(path.join(desktop, "static"), path.join(out, "chrome"), { recursive: true })
cpSync(path.join(icons, "icon-192.png"), path.join(out, "chrome", "bw-icon.png"))
cpSync(path.join(icons, "icon-512.png"), path.join(out, "icons", "icon-512.png"))
rmSync(path.join(out, "native"), { recursive: true, force: true })
cpSync(native, path.join(out, "native"), { recursive: true, force: true })
console.log("[desktop] static files copied to desktop/out")
