/**
 * The published site's one JavaScript file.
 *
 * Everything that runs in a visitor's browser lives here, as a string: the light/dark button, the form submitter, and
 * each interactive block (carousel, lightbox, counter, modal, filter buttons, copy on the code block). buildSite writes
 * it to `pagesmith.js` at the site's root, and documentHtml links to it. The before-paint theme hint stays inline in
 * the head, because it has to run before the browser paints; everything else loads with `defer`.
 *
 * The runtime does not fetch anything, does not use any dependency, and reads only data attributes on elements the
 * renderer wrote. Nothing in the editor's React tree knows this file exists.
 */

export const SITE_RUNTIME = `/* Pagesmith runtime. Generated; don't edit by hand. */
(function () {
  var doc = document;
  var reduced = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Light / dark button in the menu. Reads the current theme off <html>, flips it, remembers the choice. */
  doc.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
    function show() {
      var t = doc.documentElement.getAttribute("data-theme");
      b.setAttribute("aria-pressed", t === "dark");
      var label = b.querySelector("[data-theme-label]");
      if (label) label.textContent = t === "dark" ? "Light mode" : "Dark mode";
    }
    show();
    b.addEventListener("click", function () {
      var t = doc.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      doc.documentElement.setAttribute("data-theme", t);
      doc.documentElement.setAttribute("data-bs-theme", t);
      try { localStorage.setItem("theme", t); } catch (e) {}
      show();
    });
  });

  /* Forms. Submits in the background, shows the success or verify panel without a page reload. */
  doc.querySelectorAll("form[data-blackwall-form]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      if (f.action.endsWith("#")) return;
      e.preventDefault();
      var btn = f.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
      fetch(f.action, { method: "POST", body: new FormData(f) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (r) {
        if (!r.ok) throw new Error(r.j.error || "Couldn't send");
        f.querySelectorAll(".field, [type=submit], .cf-turnstile, .form__lead").forEach(function (el) { el.hidden = true; });
        var kindEl = f.querySelector("[name=_kind]");
        var verify = r.j.verify && kindEl && kindEl.value !== "newsletter";
        var v = f.querySelector(verify ? ".form__verify" : ".form__done"); if (v) v.hidden = false;
      }).catch(function (err) {
        var m = f.querySelector(".form__error");
        if (!m) { m = doc.createElement("p"); m.className = "form__error"; m.setAttribute("role", "alert"); f.appendChild(m); }
        m.textContent = err.message;
        if (btn) btn.disabled = false;
        if (window.turnstile) window.turnstile.reset();
      });
    });
  });

  /* Carousel. Prev / next buttons, dots, optional autoplay that pauses when a visitor hovers or focuses it. */
  doc.querySelectorAll("[data-ps-carousel]").forEach(function (root) {
    var slides = root.querySelectorAll(".carousel__slide");
    if (slides.length < 2) return;
    var i = 0, auto = Number(root.getAttribute("data-autoplay")) || 0, timer = null, stopped = false;
    var dots = root.querySelectorAll(".carousel__dot");
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.setAttribute("aria-hidden", k !== i); s.toggleAttribute("inert", k !== i); });
      dots.forEach(function (d, k) { d.setAttribute("aria-current", k === i ? "true" : "false"); });
    }
    function tick() { if (!stopped) { show(i + 1); timer = setTimeout(tick, auto); } }
    root.querySelector(".carousel__prev") && root.querySelector(".carousel__prev").addEventListener("click", function () { show(i - 1); });
    root.querySelector(".carousel__next") && root.querySelector(".carousel__next").addEventListener("click", function () { show(i + 1); });
    dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k); }); });
    show(0);
    if (auto && !reduced) {
      timer = setTimeout(tick, auto);
      ["mouseenter", "focusin"].forEach(function (ev) { root.addEventListener(ev, function () { stopped = true; if (timer) clearTimeout(timer); }); });
      ["mouseleave", "focusout"].forEach(function (ev) { root.addEventListener(ev, function () { if (!root.contains(doc.activeElement)) { stopped = false; timer = setTimeout(tick, auto); } }); });
    }
  });

  /* Lightbox. Any <button data-ps-lightbox> opens the picture inside it full-size in a dialog. */
  var lb = null;
  function openLightbox(img) {
    if (!lb) {
      lb = doc.createElement("dialog");
      lb.className = "ps-lightbox";
      lb.innerHTML = '<button type="button" class="ps-lightbox__close" aria-label="Close">×</button><img alt="">';
      lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("ps-lightbox__close")) lb.close(); });
      doc.body.appendChild(lb);
    }
    var pic = lb.querySelector("img");
    pic.src = img.currentSrc || img.src;
    pic.alt = img.alt || "";
    lb.showModal();
  }
  doc.querySelectorAll("[data-ps-lightbox]").forEach(function (btn) {
    btn.addEventListener("click", function () { var img = btn.querySelector("img"); if (img) openLightbox(img); });
  });

  /* Copy button on a code block. Falls back to selection if the clipboard API is refused. */
  doc.querySelectorAll("[data-ps-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var pre = btn.closest(".codeblock") && btn.closest(".codeblock").querySelector("code");
      if (!pre) return;
      var done = function () { var t = btn.querySelector("[data-ps-copy-label]") || btn; var old = t.textContent; t.textContent = "Copied"; setTimeout(function () { t.textContent = old; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(pre.textContent || "").then(done, function () { done(); });
      else { var r = doc.createRange(); r.selectNode(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); try { doc.execCommand("copy"); } catch (e) {} s.removeAllRanges(); done(); }
    });
  });

  /* Counter. Counts up to the target number when it scrolls into view, once. */
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var n = Number(en.target.getAttribute("data-target")) || 0;
        var dur = Number(en.target.getAttribute("data-duration")) || 1500;
        var out = en.target.querySelector(".counter__value"); if (!out) return;
        if (reduced || dur < 50) { out.textContent = String(n); return; }
        var start = performance.now();
        function step(t) {
          var p = Math.min(1, (t - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          out.textContent = String(Math.round(n * eased));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.3 });
    doc.querySelectorAll("[data-ps-counter]").forEach(function (c) { cio.observe(c); });
  } else {
    doc.querySelectorAll("[data-ps-counter]").forEach(function (c) { var v = c.querySelector(".counter__value"); if (v) v.textContent = c.getAttribute("data-target") || "0"; });
  }

  /* Modal. A <button data-ps-modal-open="id"> opens the matching <dialog id="id"> as a modal; close with Esc or [data-ps-modal-close]. */
  doc.querySelectorAll("[data-ps-modal-open]").forEach(function (b) {
    b.addEventListener("click", function () {
      var d = doc.getElementById(b.getAttribute("data-ps-modal-open"));
      if (d && typeof d.showModal === "function") d.showModal();
    });
  });
  doc.querySelectorAll("dialog.ps-modal [data-ps-modal-close]").forEach(function (b) {
    b.addEventListener("click", function () { var d = b.closest("dialog"); if (d) d.close(); });
  });
  doc.querySelectorAll("dialog.ps-modal").forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });

  /* Filter buttons. One row of buttons filters the sibling grid by each card's data-tag. */
  doc.querySelectorAll("[data-ps-filter]").forEach(function (root) {
    var buttons = root.querySelectorAll(".filter-bar__btn");
    var items = root.querySelectorAll("[data-tag]");
    function apply(tag) {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filter") === tag ? "true" : "false"); });
      items.forEach(function (it) {
        var t = it.getAttribute("data-tag") || "";
        it.hidden = !(tag === "*" || t.split(/\\s+/).indexOf(tag) >= 0);
      });
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { apply(b.getAttribute("data-filter") || "*"); }); });
    apply("*");
  });
})();
`
