/**
 * The component library: everything you can add to a page, grouped, with ready-made pieces (a picture card, a testimonial,
 * a pricing card) beside the plain blocks. Each item builds a fresh block; `placeBlock` decides where it lands.
 */
import type { SiteBlock } from "../src/lib/types.ts"
import { SECTIONS, SECTION_ORDER, mk, section } from "./sitebuilder.ts"
import { canHold, findBlock, mapTree, pathTo } from "./sitebuilder-tree.ts"

export interface LibraryItem {
  id: string
  group: string
  name: string
  about: string
  /** A whole section: it goes between sections rather than into one. */
  section?: boolean
  /** "s": a small thing (a badge, a button) that gets a short tile; the rest get a full one. */
  size?: "s"
  make: () => SiteBlock
}

export const LIBRARY_GROUPS = ["Ready-made sections", "Text", "Buttons and links", "Pictures and media", "Cards and layout", "Notes and progress", "Data and forms", "Advanced"] as const

const card = (...kids: SiteBlock[]) => mk("card", {}, kids)
const SMALL_TYPES = new Set(["heading", "text", "list", "divider", "spacer", "button", "buttons", "link", "dropdown", "badge", "breadcrumb", "tags", "alert", "tooltip", "meter", "progress", "pager"])
const plain = (id: string, group: string, name: string, about: string, type: string, props: Record<string, unknown> = {}): LibraryItem => ({ id, group, name, about, ...(SMALL_TYPES.has(type) ? { size: "s" as const } : {}), make: () => mk(type, props) })
const piece = (id: string, group: string, name: string, about: string, make: () => SiteBlock): LibraryItem => ({ id, group, name, about, make })

export const LIBRARY: LibraryItem[] = [
  ...SECTION_ORDER.map((k): LibraryItem => ({ id: `section:${k}`, group: "Ready-made sections", name: SECTIONS[k].name, about: SECTIONS[k].about, section: true, make: () => section(k) })),

  plain("heading", "Text", "Heading", "A title.", "heading"),
  plain("text", "Text", "Text", "A paragraph.", "text"),
  plain("richtext", "Text", "Rich text", "Bold, italic, links, lists and headings.", "richtext"),
  plain("quote", "Text", "Quote", "A pulled quote with who said it.", "quote"),
  plain("list", "Text", "List", "A bulleted list.", "list"),
  plain("stats", "Text", "Numbers", "Big figures with labels.", "stats"),
  plain("divider", "Text", "Divider", "A line between things.", "divider"),
  plain("spacer", "Text", "Space", "Empty room between things.", "spacer"),
  plain("code", "Text", "Code", "Code in a box that scrolls sideways.", "code"),
  plain("steps", "Text", "Numbered steps", "Steps with numbers beside them.", "steps"),
  plain("tags", "Text", "Tag list", "A row of small tags.", "tags"),
  plain("iconbox", "Text", "Icon and text", "A symbol beside a short title and line.", "iconbox"),

  plain("button", "Buttons and links", "Button", "A button that goes somewhere.", "button"),
  plain("buttons", "Buttons and links", "Button group", "Two or three buttons side by side.", "buttons"),
  plain("link", "Buttons and links", "Link", "A plain text link.", "link"),
  plain("dropdown", "Buttons and links", "Dropdown", "A button that opens a list of links.", "dropdown"),
  plain("badge", "Buttons and links", "Badge", "A small coloured label.", "badge"),
  plain("breadcrumb", "Buttons and links", "Breadcrumb", "Where this page sits in the site.", "breadcrumb"),

  plain("image", "Pictures and media", "Picture", "A picture from your library.", "image"),
  plain("video", "Pictures and media", "Video or audio", "A YouTube video or an audio file.", "video"),
  piece("photoGrid", "Pictures and media", "Photo row", "Three pictures side by side.", () => mk("row", { cols: "3" }, [mk("image", { shape: "square" }), mk("image", { shape: "square" }), mk("image", { shape: "square" })])),

  piece("team", "Cards and layout", "Person", "A picture, a name, a role and a line about them.", () => card(mk("image", { shape: "square" }), mk("heading", { level: "3", text: "Name" }), { ...mk("text", { text: "Role" }), design: { color: "muted" as const } }, mk("text"))),
  piece("caption", "Cards and layout", "Picture with caption", "A picture with a line beneath it.", () => card(mk("image"), { ...mk("text", { text: "A line about the picture." }), design: { size: "s", color: "muted" } })),
  piece("features", "Cards and layout", "Three features", "Three symbols with a title and line each.", () => mk("row", { cols: "3" }, [0, 1, 2].map(() => mk("iconbox")))),
  piece("contact-card", "Cards and layout", "Contact details", "A card with a few ways to get in touch.", () => card(mk("heading", { level: "3", text: "Get in touch" }), mk("list", { items: "Email: you@example.com\nPhone: 555 0100" }), mk("buttons", { items: "Write to me|/contact/" }))),
  plain("card", "Cards and layout", "Card", "A box for a heading and text.", "card"),
  piece("pictureCard", "Cards and layout", "Picture card", "A picture on top, then a heading, text and a button.", () => card(mk("image"), mk("heading", { level: "3" }), mk("text"), mk("button", { text: "Read more", style: "outline" }))),
  piece("featureBox", "Cards and layout", "Feature box", "A short heading and a line about it.", () => card(mk("heading", { level: "3" }), mk("text"))),
  piece("testimonial", "Cards and layout", "Testimonial", "A quote in a card.", () => card(mk("quote"))),
  piece("pricing", "Cards and layout", "Plan or price card", "A label, a price, what's included and a button.", () => card(mk("badge", { text: "Popular", tone: "primary" }), mk("heading", { level: "3", text: "$12 a month" }), mk("list", { items: "First thing included\nSecond thing included\nThird thing included" }), mk("button", { text: "Choose this" }))),
  piece("row2", "Cards and layout", "Two columns", "Two cards side by side.", () => mk("row", { cols: "2" }, [card(mk("heading", { level: "3" }), mk("text")), card(mk("heading", { level: "3" }), mk("text"))])),
  piece("row3", "Cards and layout", "Three columns", "Three cards side by side.", () => mk("row", { cols: "3" }, [0, 1, 2].map(() => card(mk("heading", { level: "3" }), mk("text"))))),
  piece("side-main", "Cards and layout", "Side and main", "A narrow column on the left and a wide one.", () => mk("row", { cols: "left" }, [card(mk("heading", { level: "3", text: "On the side" }), mk("list")), card(mk("heading", { level: "3" }), mk("richtext"))])),
  piece("main-side", "Cards and layout", "Main and side", "A wide column and a narrow one.", () => mk("row", { cols: "side" }, [card(mk("heading", { level: "3" }), mk("richtext")), card(mk("heading", { level: "3", text: "On the side" }), mk("list"))])),

  plain("alert", "Notes and progress", "Alert", "A coloured note.", "alert"),
  plain("tooltip", "Notes and progress", "Tooltip", "Words that explain themselves on hover.", "tooltip"),
  plain("meter", "Notes and progress", "Progress bar", "A bar showing how far along something is.", "meter"),
  plain("accordion", "Notes and progress", "Accordion", "Questions that open on click.", "accordion"),
  plain("progress", "Notes and progress", "Step progress", "A “Step 2 of 5” bar.", "progress"),
  plain("pager", "Notes and progress", "Previous / next", "Links to the neighbouring pages.", "pager"),

  plain("table", "Data and forms", "Table", "Rows and columns with a header row.", "table"),
  plain("calendar", "Data and forms", "Calendar", "A month with dates marked.", "calendar"),
  plain("form", "Data and forms", "Form", "A form from your library.", "form"),
  plain("newsletter", "Data and forms", "Newsletter sign-up", "An email sign-up.", "newsletter"),
  plain("postsByWeek", "Data and forms", "Posts by week", "Posts grouped by week.", "postsByWeek"),
  plain("postList", "Data and forms", "Latest posts", "Your newest posts as cards.", "postList"),

  plain("html", "Advanced", "Custom HTML", "Your own markup, published as written.", "html"),
]

/**
 * Where an added piece lands. A section goes after the section you're in (or last). Anything else goes inside the
 * selected container if it can hold it, otherwise right after the selected block, otherwise at the end of the last
 * section (a new section is made if the page is empty). Returns the new sections list.
 */
export function placeBlock(list: SiteBlock[], selectedId: string | null, block: SiteBlock): SiteBlock[] {
  if (block.type === "section") {
    const top = selectedId ? pathTo(list, selectedId)?.[0] : undefined
    const at = top ? list.findIndex((s) => s.id === top) + 1 : list.length
    return [...list.slice(0, at), block, ...list.slice(at)]
  }
  const sel = selectedId ? findBlock(list, selectedId) : undefined
  if (sel && canHold(sel, block)) return mapTree(list, sel.id, (b) => ({ ...b, kids: [...(b.kids ?? []), block] }))
  if (sel) {
    const path = pathTo(list, sel.id) ?? []
    const parent = path.length > 1 ? findBlock(list, path[path.length - 2]) : undefined
    if (parent && canHold(parent, block)) return mapTree(list, parent.id, (b) => { const at = (b.kids ?? []).findIndex((k) => k.id === sel.id) + 1; return { ...b, kids: [...(b.kids ?? []).slice(0, at), block, ...(b.kids ?? []).slice(at)] } })
  }
  const last = list[list.length - 1]
  if (last && canHold(last, block)) return mapTree(list, last.id, (b) => ({ ...b, kids: [...(b.kids ?? []), block] }))
  return [...list, mk("section", {}, [block])]
}
