/**
 * Bootstrap mode: pages load Bootstrap 5 from its CDN first and your own css/style.css second,
 * and the site is flat .html files with relative links, so it works from any folder (any host's subfolder,
 * a GitHub Pages project address, or straight off a disk). Pagesmith's own sites are untouched by anything here.
 */
import type { Site } from "../src/lib/types.ts"
import { relativePath } from "./site.ts"

export const BOOTSTRAP = {
  css: { href: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css", integrity: "sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" },
  js: { href: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js", integrity: "sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" },
} as const

/** Set by the editor (never the server): where the editor's preview loads its own copy of Bootstrap's CSS from, so a preview needs no network. */
export const previewAssets = { bootstrapCssUrl: "" }

export const isBootstrap = (site: Pick<Site, "framework">) => site.framework === "bootstrap"

/** Families worth offering; any Google Fonts family name works. */
export const SUGGESTED_FONTS = ["Inter", "Poppins", "Roboto", "Open Sans", "Lato", "Montserrat", "Nunito", "Raleway", "Merriweather", "Playfair Display", "Lora", "Source Sans 3", "Work Sans", "DM Sans", "Fira Code", "Bebas Neue"]

const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 ]{0,40}$/
/** A usable Google Fonts family name, or undefined (only letters, digits and spaces get into a stylesheet address). */
export const fontName = (v: unknown) => (typeof v === "string" && FONT_NAME.test(v.trim()) ? v.trim() : undefined)

/** The stylesheet link for the site's chosen fonts, or "" when it has none. */
export function googleFontsHref(site: Pick<Site, "fontHeading" | "fontBody">) {
  const names = [...new Set([fontName(site.fontHeading), fontName(site.fontBody)].filter((n): n is string => !!n))]
  if (!names.length) return ""
  return `https://fonts.googleapis.com/css2?${names.map((n) => `family=${n.replace(/ /g, "+")}:wght@400;600;700`).join("&")}&display=swap`
}

/** Where a site address lives as a file: "/" is index.html, "/about/" is about.html, "/posts/a/" is posts/a.html, other paths are files already. */
export function flatFile(urlPath: string) {
  const p = urlPath.replace(/^\/+/, "")
  if (!p) return "index.html"
  if (p.endsWith("/")) return `${p.slice(0, -1)}.html`
  return /\.[a-z0-9]+$/i.test(p) ? p : `${p}.html`
}

/** Turns every site-root link in a page (href, src) into one relative to that page's file, so the page works wherever it is put. */
export function relativize(html: string, fromFile: string) {
  return html.replace(/\b(href|src)="(\/(?!\/)[^"]*)"/g, (_all, attr: string, url: string) => {
    const [path, rest = ""] = url.split(/(?=[?#])/, 2)
    return `${attr}="${relativePath(fromFile, flatFile(path))}${rest}"`
  })
}

/** The look of a Bootstrap site: Bootstrap's own colors and fonts follow the site's palette, so Look still works. */
export const BOOTSTRAP_BRIDGE = `:root { --bs-body-bg: var(--bg); --bs-body-color: var(--text); --bs-secondary-color: var(--muted); --bs-tertiary-bg: var(--surface); --bs-border-color: var(--border); --bs-link-color: var(--accent); --bs-link-hover-color: var(--accent); --bs-body-font-family: var(--font); --bs-border-radius: var(--radius, 8px); }
.alert-info { --bs-alert-bg: rgba(13,139,183,.12); --bs-alert-border-color: #0d8bb7; --bs-alert-color: #075b7b; } .alert-pink { --bs-alert-bg: rgba(214,51,132,.12); --bs-alert-border-color: #d63384; --bs-alert-color: #8c2057; } .alert-purple { --bs-alert-bg: rgba(111,66,193,.12); --bs-alert-border-color: #6f42c1; --bs-alert-color: #4b2b85; } .alert-orange { --bs-alert-bg: rgba(253,126,20,.12); --bs-alert-border-color: #fd7e14; --bs-alert-color: #a85310; }
.btn-primary { --bs-btn-bg: var(--accent); --bs-btn-border-color: var(--accent); --bs-btn-color: var(--accent-text); --bs-btn-hover-bg: var(--accent); --bs-btn-hover-border-color: var(--accent); --bs-btn-hover-color: var(--accent-text); --bs-btn-active-bg: var(--accent); --bs-btn-active-border-color: var(--accent); --bs-btn-active-color: var(--accent-text); --bs-btn-focus-shadow-rgb: 128, 128, 128; }
.btn-outline-primary { --bs-btn-color: var(--accent); --bs-btn-border-color: var(--accent); --bs-btn-hover-bg: var(--accent); --bs-btn-hover-border-color: var(--accent); --bs-btn-hover-color: var(--accent-text); --bs-btn-active-bg: var(--accent); --bs-btn-active-border-color: var(--accent); --bs-btn-active-color: var(--accent-text); }
.progress { --bs-progress-bg: var(--surface); --bs-progress-bar-bg: var(--accent); --bs-progress-bar-color: var(--accent-text); --bs-progress-height: 1.5rem; }
.navbar { --bs-navbar-color: var(--text); --bs-navbar-hover-color: var(--accent); --bs-navbar-active-color: var(--accent); --bs-navbar-brand-color: var(--text); --bs-navbar-brand-hover-color: var(--accent); --bs-navbar-toggler-border-color: var(--border); background: var(--bg); border-bottom: 1px solid var(--border); }
.navbar-brand { white-space: normal; max-width: calc(100% - 5rem); }
.navbar-nav .nav-link, [data-theme-toggle] { white-space: nowrap; }
@media (min-width: 992px) { .navbar-nav { flex-wrap: wrap; } .navbar-brand { max-width: none; } }
.step-progress { margin-bottom: 1.5rem; }
.navbar .dropdown-menu { --bs-dropdown-bg: var(--bg); --bs-dropdown-link-color: var(--text); --bs-dropdown-link-hover-bg: var(--surface); --bs-dropdown-border-color: var(--border); }
.card { --bs-card-bg: var(--surface); --bs-card-border-color: var(--border); }
.table { --bs-table-bg: transparent; --bs-table-color: var(--text); --bs-table-border-color: var(--border); }
.form-control, .form-select { background-color: var(--bg); color: var(--text); border-color: var(--border); }
.skip-link { position: absolute; left: .5rem; top: -4rem; z-index: 2000; padding: .5rem 1rem; background: var(--accent); color: var(--accent-text); border-radius: var(--radius, 8px); }
.skip-link:focus { top: .5rem; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.section { padding: 4rem 0; } .section--tinted { background: var(--surface); } .container.container--narrow { max-width: 760px; }
.pic { width: 100%; height: 240px; object-fit: cover; border-radius: var(--radius, 8px); }
.pic.ph--square { aspect-ratio: 1; height: auto; } .pic.ph--tall { aspect-ratio: 4 / 5; height: auto; }
.ph { height: 240px; display: grid; place-items: center; background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius, 8px); color: var(--muted); font-size: 13px; }
.ph--square { height: 260px; } .ph--tall { height: 320px; }
.pic, .ph { margin-bottom: 1rem; } .row > .pic, .row > .ph { margin-bottom: 0; }
.prose { max-width: 70ch; } .prose img { max-width: 100%; border-radius: var(--radius, 8px); margin: 16px 0; }
.prose pre { background: var(--surface); padding: 14px; border-radius: var(--radius, 8px); overflow: auto; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
.post-card { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius, 10px); overflow: hidden; text-decoration: none; color: var(--text); background: var(--bg); }
.post-card:hover { border-color: var(--accent); }
.post-card img, .post-card__cover { width: 100%; height: 150px; object-fit: cover; background: var(--surface); }
.post-card__body { display: grid; gap: 4px; padding: 12px 14px 16px; }
.post-card__kicker { font-size: 12px; font-weight: 600; color: var(--accent); }
.post-card__title { font-weight: 700; } .post-card__summary, .post-card__meta { font-size: 14px; color: var(--muted); }
.week { margin: 0 0 40px; } .week__label { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.comments { border-top: 1px solid var(--border); } .comment { padding: 14px 0; border-bottom: 1px solid var(--border); } .comment p { margin: 0 0 6px; } .comment__meta { font-size: 14px; color: var(--muted); }
.form__error { color: #c0392b; } .field { margin: 0 0 18px; } .form { max-width: 480px; }
.step-pager { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; }
.video-embed iframe { border: 0; }
`

/** Runs in the head so the saved choice (or the device's setting) is applied before the page paints. */
/** The one script Pagesmith inlines: a tiny hint that picks the saved (or device) theme before the page paints, so visitors never see a flash. Keep the body byte-for-byte: its SHA-256 goes into the published site's CSP. */
export const THEME_INLINE_BODY = `(function(){var t;try{t=localStorage.getItem("theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var d=document.documentElement;d.setAttribute("data-theme",t);d.setAttribute("data-bs-theme",t)})();`
export const THEME_SCRIPT = `<script>${THEME_INLINE_BODY}</script>`


/** Entrance animations (Animista-style keyframes). Only the ones a site uses are written into its CSS. */
export const ANIMATIONS: Record<string, { name: string; css: string }> = {
  "fade-in": { name: "Fade in", css: "@keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }\n.bs-an-fade-in { animation: fade-in 1.2s cubic-bezier(.39,.575,.565,1) both; }" },
  "slide-in-bottom": { name: "Slide up", css: "@keyframes slide-in-bottom { 0% { transform: translateY(1000px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }\n.bs-an-slide-in-bottom { animation: slide-in-bottom .6s cubic-bezier(.25,.46,.45,.94) both; }" },
  "slide-in-left": { name: "Slide in", css: "@keyframes slide-in-left { 0% { transform: translateX(-1000px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }\n.bs-an-slide-in-left { animation: slide-in-left .6s cubic-bezier(.25,.46,.45,.94) both; }" },
  "scale-in": { name: "Grow", css: "@keyframes scale-in { 0% { transform: scale(.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }\n.bs-an-scale-in { animation: scale-in .5s cubic-bezier(.25,.46,.45,.94) both; }" },
  "bounce-in-top": { name: "Bounce", css: "@keyframes bounce-in-top { 0% { transform: translateY(-500px); animation-timing-function: ease-in; opacity: 0; } 38% { transform: translateY(0); animation-timing-function: ease-out; opacity: 1; } 55% { transform: translateY(-65px); animation-timing-function: ease-in; } 72% { transform: translateY(0); animation-timing-function: ease-out; } 81% { transform: translateY(-28px); animation-timing-function: ease-in; } 90% { transform: translateY(0); animation-timing-function: ease-out; } 95% { transform: translateY(-8px); animation-timing-function: ease-in; } 100% { transform: translateY(0); animation-timing-function: ease-out; } }\n.bs-an-bounce-in-top { animation: bounce-in-top 1.1s both; }" },
  pulsate: { name: "Pulse", css: "@keyframes pulsate-fwd { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }\n.bs-an-pulsate { animation: pulsate-fwd .5s ease-in-out infinite both; }" },
}
export const REDUCED_MOTION_CSS = "@media (prefers-reduced-motion: reduce) { [class*=\"bs-an-\"] { animation: none !important; } }"

/** The look of the components Bootstrap doesn't have, or that are built without scripts: the same in both modes. */
export const COMPONENT_CSS = `.badge { display: inline-block; padding: .25em .65em; border-radius: 999px; font-size: .8em; font-weight: 700; line-height: 1.4; }
.badge--primary, .text-bg-primary { background: var(--accent) !important; color: var(--accent-text) !important; }
.badge--secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.badge--success, .text-bg-success { background: #1e7e34 !important; color: #fff !important; } .badge--info, .text-bg-info { background: #0d8bb7 !important; color: #fff !important; } .badge--warning, .text-bg-warning { background: #ffc107 !important; color: #111 !important; } .badge--danger, .text-bg-danger { background: #b02a37 !important; color: #fff !important; } .badge--pink, .text-bg-pink { background: #d63384 !important; color: #fff !important; } .badge--purple, .text-bg-purple { background: #6f42c1 !important; color: #fff !important; } .badge--orange, .text-bg-orange { background: #fd7e14 !important; color: #111 !important; }
.callout { padding: 12px 16px; border: 1px solid var(--border); border-left: 4px solid var(--tone, var(--accent)); border-radius: var(--radius, 8px); background: var(--surface); color: var(--text); margin: 0 0 20px; }
.callout--secondary { --tone: var(--muted); } .callout--success { --tone: #1e7e34; } .callout--info { --tone: #0d8bb7; } .callout--warning { --tone: #e0a800; } .callout--danger { --tone: #b02a37; } .callout--pink { --tone: #d63384; } .callout--purple { --tone: #6f42c1; } .callout--orange { --tone: #fd7e14; }
.dd { position: relative; display: inline-block; } .dd > summary { list-style: none; cursor: pointer; } .dd > summary::-webkit-details-marker { display: none; } .dd > summary::after { content: " \\25BE"; }
.dd__menu { position: absolute; z-index: 20; margin: 4px 0 0; padding: 6px 0; min-width: 180px; list-style: none; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius, 8px); }
.dd__menu a { display: block; padding: 6px 14px; text-decoration: none; white-space: nowrap; }
.tip { position: relative; border-bottom: 1px dotted currentColor; cursor: help; }
.tip__text { position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%); z-index: 30; width: max-content; max-width: 260px; padding: 6px 10px; border-radius: 6px; background: var(--text); color: var(--bg); font-size: 14px; font-weight: 400; line-height: 1.4; opacity: 0; pointer-events: none; transition: opacity .12s; }
.tip:hover .tip__text, .tip:focus .tip__text, .tip:focus-within .tip__text { opacity: 1; }
.acc { border: 1px solid var(--border); border-radius: var(--radius, 8px); margin: 0 0 8px; background: var(--surface); }
.acc > summary { padding: 12px 16px; cursor: pointer; font-weight: 600; } .acc__body { padding: 0 16px 6px; }
.calendar { table-layout: fixed; text-align: center; } .calendar caption { text-align: left; font-weight: 700; padding-bottom: 8px; color: var(--text); }
.calendar td { height: 64px; vertical-align: top; padding: 4px; } .calendar__empty { background: transparent; }
.calendar__day { display: block; font-weight: 600; } .calendar__ev { display: block; margin-top: 2px; padding: 1px 4px; border-radius: 4px; background: var(--accent); color: var(--accent-text); font-size: 12px; line-height: 1.3; }
.quote { margin: 0 0 20px; padding: 4px 0 4px 18px; border-left: 4px solid var(--accent); } .quote blockquote { margin: 0; font-size: 1.25em; font-style: italic; } .quote p { margin: 0 0 8px; } .quote figcaption { color: var(--muted); }
.btn-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 20px; }
.breadcrumb { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0 0 16px; font-size: .95em; } .breadcrumb-item + .breadcrumb-item::before { content: "/"; padding-right: 6px; color: var(--muted); } .breadcrumb-item.active { color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 20px; margin: 0 0 20px; } .stat { display: flex; flex-direction: column-reverse; gap: 2px; text-align: center; }
.stat dd { margin: 0; font-size: 2.2em; font-weight: 700; line-height: 1.1; color: var(--accent); } .stat dt { color: var(--muted); font-size: .95em; font-weight: 400; }
.spacer--s { height: 16px; } .spacer--m { height: 32px; } .spacer--l { height: 64px; } .spacer--xl { height: 112px; }
.codeblock { margin: 0 0 20px; } .codeblock figcaption { font-size: .85em; color: var(--muted); margin-bottom: 4px; }
.codeblock pre { margin: 0; padding: 14px; overflow: auto; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius, 8px); font: .9em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.steps { list-style: none; counter-reset: step; margin: 0 0 20px; padding: 0; display: grid; gap: 14px; }
.steps li { counter-increment: step; display: grid; grid-template-columns: 2.2em 1fr; gap: 12px; align-items: start; }
.steps li::before { content: counter(step); display: grid; place-items: center; width: 2.2em; height: 2.2em; border-radius: 50%; background: var(--accent); color: var(--accent-text); font-weight: 700; }
.steps b, .steps span { grid-column: 2; display: block; } .steps span { color: var(--muted); }
.tags { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0 0 20px; padding: 0; }
.iconbox { display: flex; gap: 14px; align-items: flex-start; margin: 0 0 20px; } .iconbox p { margin: 0; } .iconbox__title { display: block; }
.iconbox__icon { flex: none; display: grid; place-items: center; width: 2.6em; height: 2.6em; border-radius: var(--radius, 8px); background: var(--surface); border: 1px solid var(--border); font-size: 1.3em; }
.site-extras { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.carousel { position: relative; margin: 0 0 20px; }
.carousel__slides { list-style: none; margin: 0; padding: 0; position: relative; }
.carousel__slide { position: absolute; inset: 0; opacity: 0; transition: opacity .35s ease; }
.carousel__slide[aria-hidden="false"] { position: relative; opacity: 1; }
.carousel__slide img, .carousel__slide .pic { width: 100%; height: auto; border-radius: var(--radius, 8px); }
.carousel__prev, .carousel__next { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 999px; width: 2.4em; height: 2.4em; cursor: pointer; font-size: 1.2em; line-height: 1; display: grid; place-items: center; }
.carousel__prev { left: 10px; } .carousel__next { right: 10px; }
.carousel__dots { display: flex; gap: 6px; justify-content: center; margin-top: 10px; }
.carousel__dot { width: 10px; height: 10px; padding: 0; border-radius: 999px; border: 1px solid var(--border); background: transparent; cursor: pointer; }
.carousel__dot[aria-current="true"] { background: var(--accent); border-color: var(--accent); }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin: 0 0 20px; }
.gallery__btn { padding: 0; border: 0; background: transparent; cursor: zoom-in; }
.gallery__btn img, .gallery__btn .pic { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1; border-radius: var(--radius, 8px); display: block; }
.ps-lightbox { max-width: 94vw; max-height: 94vh; padding: 0; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius, 8px); }
.ps-lightbox::backdrop { background: rgba(0, 0, 0, .7); }
.ps-lightbox img { max-width: 94vw; max-height: 80vh; display: block; }
.ps-lightbox__close { position: absolute; top: 6px; right: 10px; background: transparent; color: inherit; border: 0; font-size: 1.6em; line-height: 1; cursor: pointer; }
.codeblock { position: relative; }
.codeblock__copy { position: absolute; top: 6px; right: 6px; padding: 4px 10px; border-radius: var(--radius, 6px); border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: .8em; cursor: pointer; opacity: .85; }
.codeblock:hover .codeblock__copy, .codeblock:focus-within .codeblock__copy { opacity: 1; }
.counter { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1rem; }
.counter__value { font-size: 2.6em; font-weight: 800; color: var(--accent); line-height: 1.05; font-variant-numeric: tabular-nums; }
.counter__label { color: var(--muted); font-size: .95em; margin-top: 4px; }
.ps-modal { max-width: 640px; width: calc(100% - 2rem); padding: 1.25rem 1.5rem; border: 1px solid var(--border); border-radius: var(--radius, 10px); background: var(--bg); color: var(--text); }
.ps-modal::backdrop { background: rgba(0, 0, 0, .5); }
.ps-modal__close { position: absolute; top: 6px; right: 10px; background: transparent; color: inherit; border: 0; font-size: 1.4em; line-height: 1; cursor: pointer; }
.ps-modal__title { margin: 0 2rem 0.75rem 0; font-size: 1.15em; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 1rem; }
.filter-bar__btn { padding: 4px 10px; border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 999px; cursor: pointer; font: inherit; font-size: .9em; }
.filter-bar__btn[aria-pressed="true"] { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.filter-grid__items { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
.ps-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 0; vertical-align: -0.125em; color: inherit; }
.ps-icon--s { width: 16px; height: 16px; } .ps-icon--m { width: 24px; height: 24px; } .ps-icon--l { width: 40px; height: 40px; }
.ps-icon svg { width: 100%; height: 100%; display: block; }
.btn .ps-icon, .badge .ps-icon { margin-right: .35em; }
.filter-grid__item[hidden] { display: none !important; }
`
