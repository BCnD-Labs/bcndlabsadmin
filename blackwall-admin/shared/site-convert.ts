/**
 * "Change to…": swapping one block for another kind (a button for a badge, a card for a tooltip or a progress bar) while
 * keeping what you wrote. A block's content is read as a few plain slots (a title, some body text, a link, a list of
 * items); the new kind is built from whichever slots it can use. The block keeps its place, its id (so it stays selected)
 * and its Style choices. Whatever the new kind has no room for is dropped, which is why the menu only offers sensible swaps.
 */
import type { SiteBlock } from "../src/lib/types.ts"
import { BLOCKS, mk, pairLines } from "./sitebuilder.ts"

interface Slots { title: string; body: string; href: string; items: string; src: string; alt: string; /** A heading's words only (never a button label). */ head: string }

const first = (v: unknown) => String(v ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? ""
const short = (v: string) => (v.length > 40 ? `${v.slice(0, 37).trimEnd()}…` : v)
const thisMonth = () => new Date().toISOString().slice(0, 7)

/** What a block says, as slots. */
function slotsOf(b: SiteBlock): Slots {
  const s: Slots = { title: "", body: "", href: "", items: "", src: "", alt: "", head: "" }
  switch (b.type) {
    case "card": {
      const kids = b.kids ?? []
      s.title = String(kids.find((k) => k.type === "heading")?.text ?? "").trim()
      s.head = s.title
      s.body = kids.filter((k) => k.type === "text" || k.type === "richtext").map((k) => String(k.type === "text" ? k.text : k.md ?? "").trim()).filter(Boolean).join("\n\n")
      s.href = String(kids.find((k) => k.type === "button" || k.type === "link")?.href ?? "").trim()
      if (!s.title) s.title = String(kids.find((k) => k.type === "button" || k.type === "link")?.text ?? "").trim()
      const pic = kids.find((k) => k.type === "image")
      s.src = String(pic?.src ?? "").trim(); s.alt = String(pic?.alt ?? "").trim()
      break
    }
    case "image": s.src = String(b.src ?? "").trim(); s.alt = String(b.alt ?? "").trim(); s.title = s.alt; break
    case "quote": s.body = String(b.text ?? "").trim(); s.title = String(b.who ?? "").trim(); break
    case "buttons": s.items = String(b.items ?? ""); s.title = pairLines(b.items)[0]?.[0] ?? ""; s.href = pairLines(b.items)[0]?.[1] ?? ""; break
    case "heading": case "button": case "link": case "badge": s.title = String(b.text ?? "").trim(); s.href = String(b.href ?? "").trim(); break
    case "text": s.body = String(b.text ?? "").trim(); s.title = first(b.text); break
    case "richtext": s.body = String(b.md ?? "").trim(); s.title = first(b.md).replace(/^#+\s*/, ""); break
    case "alert": s.body = String(b.text ?? "").trim(); s.title = first(b.text); break
    case "list": s.body = String(b.items ?? "").trim(); s.title = first(b.items); break
    case "tooltip": s.title = String(b.text ?? "").trim(); s.body = String(b.tip ?? "").trim(); break
    case "dropdown": s.title = String(b.label ?? "").trim(); s.items = String(b.items ?? ""); s.href = pairLines(b.items)[0]?.[1] ?? ""; break
    case "accordion": s.items = String(b.items ?? ""); s.title = pairLines(b.items)[0]?.[0] ?? ""; s.body = pairLines(b.items).map(([q, a]) => (a ? `${q}: ${a}` : q)).join("\n"); break
    case "meter": s.title = String(b.label ?? "").trim(); break
    case "calendar": s.body = String(b.events ?? "").trim(); break
    case "progress": s.title = `Step ${b.current ?? ""} of ${b.total ?? ""}`; break
  }
  if (!s.head && b.type === "heading") s.head = s.title
  return s
}

/** The words for a small thing (a badge, a button): the title, or failing that the first words of the body. */
const label = (s: Slots) => s.title || short(first(s.body))
const href = (s: Slots) => s.href

/** The props (and children) of the new kind. */
function build(to: string, s: Slots, old: SiteBlock): { props: Record<string, unknown>; kids?: SiteBlock[] } {
  const style = old.style === "outline" ? "outline" : "solid"
  const tone = ["primary", "secondary", "success", "warning", "danger"].includes(String(old.tone)) ? old.tone : "primary"
  switch (to) {
    case "heading": return { props: { level: old.type === "heading" ? old.level : "2", text: label(s) } }
    case "text": return { props: { text: s.body || s.title } }
    case "richtext": return { props: { md: s.body || s.title } }
    case "button": return { props: { text: label(s), href: href(s), style } }
    case "link": return { props: { text: label(s), href: href(s) } }
    case "badge": return { props: { text: label(s), tone } }
    case "alert": return { props: { text: [s.title !== first(s.body) ? s.title : "", s.body].filter(Boolean).join(": ") || s.title, tone } }
    case "tooltip": return { props: { text: label(s), tip: s.body && s.body !== label(s) ? s.body : "" } }
    case "dropdown": return { props: { label: label(s) || "Menu", items: s.items || `${label(s) || "First option"}|${href(s) || "/"}\nSecond option|/`, style } }
    case "accordion": return { props: { items: s.items || `${s.title || "Heading"}|${s.body}` } }
    case "meter": return { props: { label: label(s), value: 50 } }
    case "progress": return { props: { current: 1, total: 5 } }
    case "calendar": return { props: { month: thisMonth(), events: s.body.split("\n").filter((l) => /^\d{4}-\d{2}-\d{2}\|/.test(l)).join("\n") } }
    case "image": return { props: { src: s.src, alt: s.alt || s.head } }
    case "quote": return { props: { text: s.body || s.title, who: "" } }
    case "buttons": return { props: { items: s.items || `${label(s) || "Main action"}|${href(s) || "/"}\nSecond action|/`, style } }
    case "card": return { props: {}, kids: [...(s.src || old.type === "image" ? [mk("image", { src: s.src, alt: s.alt })] : []), ...(old.type === "image" ? [] : [mk("heading", { level: "3", text: s.title })]), ...(s.body ? [mk("text", { text: s.body })] : []), ...(s.href ? [mk("button", { text: "Read more", href: s.href })] : [])] }
    default: return { props: {} }
  }
}

const SMALL = ["button", "link", "badge", "dropdown", "buttons", "tooltip", "calendar"]
/** What each kind of block can become. Small things swap among themselves; a card can become any of the small or inline pieces. */
const TARGETS: Record<string, string[]> = {
  button: SMALL.filter((t) => t !== "button").concat(["alert"]),
  link: SMALL.filter((t) => t !== "link").concat(["alert"]),
  badge: SMALL.filter((t) => t !== "badge").concat(["alert"]),
  dropdown: SMALL.filter((t) => t !== "dropdown"),
  buttons: SMALL.filter((t) => t !== "buttons"),
  tooltip: SMALL.filter((t) => t !== "tooltip").concat(["alert"]),
  calendar: SMALL.filter((t) => t !== "calendar"),
  card: ["image", "quote", "tooltip", "meter", "alert", "accordion", "badge", "button", "buttons", "dropdown"],
  image: ["card"],
  quote: ["text", "heading", "alert", "card", "badge"],
  heading: ["text", "card", "quote", "badge", "button", "link", "alert", "tooltip"],
  text: ["alert", "quote", "tooltip", "heading", "richtext", "badge", "card", "accordion"],
  richtext: ["alert", "quote", "text", "card", "accordion"],
  alert: ["text", "quote", "badge", "tooltip", "card", "accordion"],
  list: ["accordion", "richtext", "card", "dropdown"],
  accordion: ["card", "list", "richtext", "alert", "dropdown"],
  meter: ["progress", "badge", "alert", "card"],
  progress: ["meter"],
}

/** Which kinds fit in the site header beside the menu. */
export const HEADER_KINDS = ["button", "buttons", "link", "badge", "dropdown", "tooltip", "calendar"]

const ABOUT: Record<string, string> = {
  button: "A button that goes somewhere.", link: "A plain text link.", badge: "A small coloured label.", dropdown: "A button that opens a list of links.",
  tooltip: "Words that explain themselves on hover.", calendar: "A month with dates marked.", alert: "A coloured note.", accordion: "Questions that open on click.",
  meter: "A bar showing how far along something is.", progress: "A “Step 2 of 5” bar.", card: "A box with a heading and text.", heading: "A title.", text: "A paragraph.",
  richtext: "Formatted text.", list: "A bulleted list.", image: "A picture from your library.", quote: "A pulled quote with who said it.", buttons: "Two or three buttons side by side.",
}

export interface ConvertTarget { type: string; name: string; about: string }

/** The kinds a block can be changed to, in menu order. In the header only small pieces fit. */
export function convertTargets(b: SiteBlock, where: "page" | "header" = "page"): ConvertTarget[] {
  return (TARGETS[b.type] ?? []).filter((t) => BLOCKS[t] && (where === "page" || HEADER_KINDS.includes(t))).map((type) => ({ type, name: BLOCKS[type].name, about: ABOUT[type] ?? "" }))
}

/** The block as another kind: same id and Style, content carried over as far as it fits. Anything not on offer changes nothing. */
export function convertBlock(b: SiteBlock, to: string, where: "page" | "header" = "page"): SiteBlock {
  if (!convertTargets(b, where).some((t) => t.type === to)) return b
  const { props, kids } = build(to, slotsOf(b), b)
  const next = mk(to, props, kids)
  return { ...next, id: b.id, ...(b.design ? { design: b.design } : {}) }
}
