# Pagesmith's Bootstrap mode

A site can be built with Pagesmith's own light styles (the default) or with Bootstrap 5. This note covers the Bootstrap option, which is general: any site can use it, and it isn't tied to a particular site or purpose.

## Turning it on

- **Settings → Built with → Bootstrap 5**, or **New site → Tutorial guide (Bootstrap)**, a nine-page starter (home, overview, five steps with progress bars, gallery, contact) that you can reshape or throw away.
- Pages load Bootstrap 5.3.3 from jsDelivr (with an integrity hash) first, then `css/style.css` second, so your own rules win.
- The site is flat `.html` files with relative links (`index.html`, `step-1.html`, `css/style.css`, `images/…`). It works from any folder: a web host's subfolder, a GitHub Pages project address, or straight off a disk. Redirects are not written in this mode.

## What you get

| Need | Where | Notes |
|---|---|---|
| Colours and fonts as CSS variables | Look | Written as `:root` variables at the top of `css/style.css`; Bootstrap's colours follow them. |
| Google Fonts for headings and body | Look → Google Fonts | Any family from fonts.google.com. |
| Your own overrides | Look → Your CSS | Added at the end of `css/style.css`, after Bootstrap. |
| Light/dark button | Look | Remembers the visitor's choice; needs the dark palette. |
| Responsive grid | Row block | Bootstrap `row` and `col-12 col-md-*`: stacked on phones, split on tablets and up. A menu button replaces the menu on phones. |
| Step progress, previous/next | Blocks | A "Step N of M" bar, and links to the neighbouring pages in menu order. |
| Video or audio | Video or audio block | YouTube (embedded with `youtube-nocookie`) or an audio file; a title is required. The editor shows a placeholder; it plays on the published page. |
| Entrance animation | Style → Animation | Six Animista-style effects; skipped for visitors who ask for less motion. |
| Pictures | Assets | Crop and convert to WebP; a picture with no description is an error in the Accessibility panel. |

## Accessibility panel

Website editor → **Accessibility**. It reports in WAVE's five kinds (errors, contrast errors, alerts, features, structure), for this page or the whole site, and can draw them as marks on the page. Clicking a finding selects its block.

It reads the site's own blocks and colours, so it finds problems before you publish. It does **not** replace WAVE or Lighthouse: it can't see inside Custom HTML or your own CSS, can't judge whether a description is any good, and can't see captions in a video. Run WAVE (wave.webaim.org) and Lighthouse on the live site for the final word. What it can't check is listed at the bottom of the panel.

## Putting it online

- **Any web host:** Get files → Download .zip, unzip, and upload the contents into a folder. Nothing depends on the folder's name or position.
- **GitHub Pages:** connect a repository in Settings and use Publish, or upload the zip. Links are relative, so a project address like `you.github.io/repo/` works.

## Test case

The first real test of this mode is a multi-page course project (a tutorial site with a progress bar, a theme toggle, Google Fonts, an animation, a video and a WAVE/Lighthouse pass). It is a yardstick for whether the tool works, not something the tool is shaped around.
