# Pagesmith for the ADD 103 capstone

How to build the 8 to 10 page Step-by-Step Tutorial Guide in Pagesmith, and what is still yours to do by hand. The site's own files are the deliverable; submitting in Canvas is not part of Pagesmith.

## Start

Website → **New site** → **Tutorial guide (Bootstrap)**. It makes nine pages (Home, Overview, Step 1 to 5, Gallery, Contact), turns on Bootstrap mode, the light/dark button and Poppins + Inter, and puts a "Step N of 5" bar and previous/next links on every step. Rename the pages, write your text (the site check lists every placeholder left), and add pictures from Assets.

## Checklist, item by item

| Capstone requirement | Where in Pagesmith | Notes |
|---|---|---|
| 8 to 10 HTML pages | Pages pane, New page | The template has 9. Each is its own `.html` file (`index.html`, `step-1.html`, ...). |
| Master template: same header, menu, footer everywhere | Automatic | One header, menu and footer are drawn on every page. |
| HTML5 landmarks, `lang`, one `<h1>` | Automatic | `header`, `nav`, `main`, `footer`; the Accessibility panel warns if a page lacks a page title or skips heading levels. |
| Bootstrap 5 CDN first, custom `style.css` second | Settings → **Built with** → Bootstrap 5 | Bootstrap 5.3.3 from jsDelivr (with integrity hash), then `css/style.css`. |
| CSS variables in `:root`, in `style.css` | Look | Your palette and fonts are written as `:root` variables at the top of `css/style.css`; Bootstrap's colours follow them. |
| Google Fonts for headings and body | Look → **Google Fonts** | Any family name from fonts.google.com. |
| Override Bootstrap buttons, navbar, link hover | Look → **Your CSS** | Added at the end of `css/style.css`, after Bootstrap. |
| Progress bar on step pages | **Step progress** block | Bootstrap `.progress` / `.progress-bar` with the right ARIA. |
| Light/Dark toggle in the navbar | Look → light/dark button | Remembers the visitor's choice; uses the dark palette. |
| Responsive grid | Row block | Bootstrap `row` and `col-12 col-md-*` columns: stacked on phones, split on tablets and up. A menu button replaces the menu on phones. |
| WebP/JPEG with alt text, transparent PNG | Assets, Picture block | Crop and convert to WebP in Assets; a picture with no description is an error in the Accessibility panel. |
| YouTube iframe or audio player | **Video or audio** block | Paste a YouTube link (embedded with `youtube-nocookie`) or an `.mp3`. Needs a title. The editor shows a placeholder; it plays on the published page. |
| One CSS animation (Animista-style) | Inspector → Style → **Animation** | Six entrance animations; keyframes are written only when used, and skipped for visitors who ask for less motion. |
| WAVE and Lighthouse | Accessibility panel (before you publish) | See below. |
| Deploy to mccweb.net and GitHub | Get files, Publish | The site works from any folder because every link is relative. |

## Accessibility panel

Website editor → **Accessibility**. It reports in WAVE's five kinds (Errors, Contrast, Alerts, Features, Structure), for this page or the whole site, and can draw them as marks on the page. Clicking a finding selects its block.

It reads the site's own blocks and colours, so it can tell you what is wrong before you publish. It does **not** replace WAVE or Lighthouse: it cannot see inside Custom HTML or your own CSS, cannot judge whether alt text is any good, and cannot see captions inside a video. Run WAVE (wave.webaim.org) and Lighthouse on the live site for the graded result. Everything it can't check is listed at the bottom of the panel.

## Putting it online

- **mccweb.net (cPanel):** Get files → Download .zip, unzip, and upload the contents into your folder (for example `public_html/final_project/`). Nothing depends on the folder's name or position.
- **GitHub Pages (the e-portfolio copy):** connect a repository in Settings and use Publish, or upload the zip. Because links are relative, a project address like `you.github.io/repo/` works.

## What this does not do

- Run Lighthouse or WAVE for you.
- Make the wireframe or the written proposal.
- Upload to mccweb.net.
- Check a Custom HTML block.
