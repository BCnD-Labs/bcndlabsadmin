/** Pure rules for the look of the app: the theme list, custom accent colour maths and value cleaning. No DOM here. */

export const THEMES = [
  { value: "dim", label: "Dim", blurb: "Soft slate", swatch: ["#1f2228", "#2a2f37", "#e7eaee"] },
  { value: "graphite", label: "Graphite", blurb: "Neutral grey, the Mac desktop look", swatch: ["#28292b", "#303134", "#f2f3f5"] },
  { value: "dark", label: "Dark", blurb: "Near-black terminal", swatch: ["#0b0e14", "#161a22", "#e9ecf1"] },
  { value: "midnight", label: "Midnight", blurb: "Deep blue-black", swatch: ["#0a0f1e", "#121a2e", "#e6eaf5"] },
  { value: "mocha", label: "Mocha", blurb: "Warm dark brown", swatch: ["#1d1a18", "#2a2522", "#efe9e3"] },
  { value: "forest", label: "Forest", blurb: "Dark green-grey", swatch: ["#171d1b", "#212a27", "#e6eeea"] },
  { value: "light", label: "Light", blurb: "Bright and clean", swatch: ["#f3f4f6", "#ffffff", "#1c2128"] },
] as const
export type Theme = (typeof THEMES)[number]["value"]
export const isTheme = (v: unknown): v is Theme => THEMES.some((t) => t.value === v)
/** An unknown stored theme falls back to the platform's default. */
export const cleanTheme = (v: unknown, fallback: Theme): Theme => (isTheme(v) ? v : fallback)

export const ROUNDNESS = [{ value: "sharp", label: "Sharp" }, { value: "default", label: "Default" }, { value: "round", label: "Round" }] as const
export type Roundness = (typeof ROUNDNESS)[number]["value"]
export const cleanRoundness = (v: unknown): Roundness => (v === "sharp" || v === "round" ? v : "default")

/** `#rrggbb` (lower case) or "" for none. Accepts `#rgb` and a missing `#`. */
export function cleanHex(v: unknown): string {
  if (typeof v !== "string") return ""
  let s = v.trim().toLowerCase().replace(/^#/, "")
  if (/^[0-9a-f]{3}$/.test(s)) s = s.replace(/./g, (c) => c + c)
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : ""
}

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
const toHex = (c: number[]) => `#${c.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("")}`
const mix = (a: number[], b: number[], t: number) => a.map((n, i) => n + (b[i] - n) * t)
/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((n) => { const c = n / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export interface AccentVars { base: string; hover: string; ledge: string; soft: string; light: string; text: string; on: string }
/** Every accent-derived colour from one picked colour, so buttons stay readable whatever is chosen. */
export function accentVars(hex: string): AccentVars {
  const c = rgb(hex)
  return {
    base: hex,
    hover: toHex(mix(c, [0, 0, 0], 0.12)),
    ledge: toHex(mix(c, [0, 0, 0], 0.38)),
    soft: `rgba(${c.join(", ")}, 0.15)`,
    light: toHex(mix(c, [255, 255, 255], 0.45)),
    text: toHex(mix(c, [255, 255, 255], 0.6)),
    // Text on a button of this colour: white unless the colour is light.
    on: luminance(hex) > 0.45 ? "#14171c" : "#ffffff",
  }
}
