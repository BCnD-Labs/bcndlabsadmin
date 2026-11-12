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
