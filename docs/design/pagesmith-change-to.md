# Pagesmith: Change to… and header items

The aim is to keep the pieces of a page swappable without a design tool's learning curve: pick a template, click the thing you want to change, and turn it into something else.

## Change to…

Select any block (click it in the preview, or in Layers) and use **Change to…** in the inspector, or the **⇄** button on the block's toolbar in the preview. The block keeps its place, its Style choices (alignment, spacing, background, animation) and as much of what you wrote as the new kind has room for: its words, its link, its list of items. **Undo** brings the old block back.

Only sensible swaps are offered:

| From | Can become |
|---|---|
| Button, Link, Badge, Tooltip | each other, a Dropdown, a Calendar, an Alert |
| Dropdown, Calendar | the small pieces above |
| Card | Tooltip, Progress bar, Alert, Accordion, Badge, Button, Dropdown |
| Heading | Text, Badge, Button, Link, Alert, Tooltip |
| Text, Rich text | Alert, Card, Accordion (Text also: Tooltip, Heading, Rich text, Badge) |
| Alert | Text, Badge, Tooltip, Card, Accordion |
| List, Accordion | each other where it fits, Card, Rich text, Dropdown |
| Progress bar, Step progress | each other (Progress bar also: Badge, Alert, Card) |

A card can't become a card inside a card. Pictures and videos have nothing to turn into.

## The components

Badge, Alert, Dropdown, Tooltip, Progress bar, Accordion and Calendar are blocks you can add from any section's **+** menu as well. They are built to work without scripts wherever possible (a dropdown and an accordion use the browser's own `details` element; a tooltip shows on hover and on keyboard focus; a calendar is a real table with a caption and day headings), so they work on any host. In Bootstrap mode a badge, alert and dropdown use Bootstrap's own classes. The editor shows a dropdown's options open so you can see them.

## Header items

With nothing selected, the inspector's **Header items** lists extra pieces drawn beside the menu on every page (a button, a badge, a dropdown, a tooltip, a calendar) and lets you add one. Click a header item in the preview to edit it or change it like any other block. Header items are optional: a site without any is unchanged.

## Preview and Bootstrap

The editor preview of a Bootstrap site uses the Bootstrap CSS bundled with the app, so it needs no outside host and works offline. Published sites still load Bootstrap from the CDN.

## Component library

The **Components** button in the Website toolbar opens a library of everything you can add, grouped (ready-made sections, text, buttons and links, pictures and media, cards and layout, notes and progress, data and forms, advanced) and shown in your own site's look. Search it, then click one to add it. It goes **inside the selected block if it fits, after it if not, or at the end of the page**; the panel stays open so you can add several. Ready-made pieces include a Picture card, Feature box, Testimonial, Plan or price card, two and three column rows and a Main-and-side layout, next to the plain blocks.

Newer blocks: Quote, Button group, Breadcrumb (it shows the page's path once the page sits under another) and Numbers.

## Swaps added

A **card can become a Picture** (and a picture a card, keeping its picture and description), a Quote, a Button group and the other pieces above; headings can become cards or quotes; text, rich text and alerts can become quotes. A button label is never used as a picture's description.

## Style options

Select any block and open **Style**: text size, text colour (accent or quiet), a small-caps label look, width (full, medium, narrow), padding inside, background (shaded, soft tint, accent, dark), corners (square, round, pill), shadow, a thin outline, plus the alignment, spacing and animation that were already there. An unstyled site carries none of the extra CSS.

## Layout: moving, swapping and widths

- **Move left and right.** Select a block inside a row and the move buttons on its toolbar read **←** and **→** (they stay ↑ and ↓ elsewhere). Alt+arrow keys and dragging in Layers do the same.
- **A width belongs to its block.** A ready-made split such as "Wide left, narrow right" used to belong to the *positions*, so moving the wide card just put it in the narrow slot. Moving or swapping a block now writes the split onto the blocks first, so the wide card stays wide wherever you put it.
- **Swap with…** (in the inspector) trades places with any other block in the same place: two cards, two headings, two sections. Widths go with the blocks.
- **Width in the row** (Style tab, for a block inside a row): Auto, ¼, ⅓, ½, ⅔, ¾ or Full, in twelfths of the row. Blocks you haven't set share what's left. **Even out the column widths** on the row puts everything back to its ready-made split.
- **Row options:** more ready-made splits (two, three or four equal; wide left; narrow left) plus the **space between** columns and how they **line up** (same height, top or middle).
- **Section and block options:** content width (medium, narrow, wide, full) that reaches inside a section's content, a minimum **height** (small to full screen), and **Show on** (everywhere, desktop only or phone only).
- Rows stack on phones in order. Rows from before this change draw exactly as they did.
