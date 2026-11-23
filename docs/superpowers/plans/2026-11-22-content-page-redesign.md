# Content Pages and Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Acadex content page the same designed shell as the home page, and reduce the top navigation to five items so it never wraps.

**Architecture:** The content pages are pre-rendered from Markdown by `scripts/content.mjs`; the home page is pre-rendered from `src/page.html` by `scripts/build.mjs`. Both shells share `assets/site.css`. The work adds a grouped navigation model (links and `<details>` dropdowns), a content-page layout (two-column hero, sticky table of contents, numbered sections, card lists, calmer links, FAQ/related/CTA cards), and the CSS that makes it hold at every width. No page copy is rewritten and no script is added to content pages.

**Tech Stack:** Node.js 24, plain HTML/CSS, a small static-site build (`scripts/build.mjs`, `scripts/content.mjs`), `node:test` and `node:assert`, Chrome headless for visual checks.

**Spec:** `docs/superpowers/specs/2026-11-22-content-page-redesign-design.md`

## Global Constraints

- Static, pre-rendered HTML. No inline `<script>` or `style` attributes (the CSP refuses them).
- Content pages may contain only `analytics.js` and `application/ld+json`; no `<button>`, no `data-i18n`, no page script.
- One `<h1>` per page; heading levels may not skip.
- Every page exists in FR and AR and works in RTL. The three dictionaries carry exactly the same keys.
- Do not change page titles, descriptions, copy, prices or FAQ text.
- Images keep `width`, `height` and `alt`.
- Pricing still reuses the `#plans` section of `src/page.html`.
- The home page hero and sections below the nav do not change.
- Body reading column: max 660 px, 17.5 px type, roughly 70–76 characters.
- Top-level nav: five items in FR/AR, four in EN; empty groups are hidden.
- After any source change: `node scripts/build.mjs`, `node --test`, and commit sources plus generated files together.
- Baseline: 63/63 tests pass.

## Review Focus

These are the failure modes the spec implies but no unit test can fully exercise. Check each during Task 4.

1. **960–1079 px**: the rail and two-column hero are visible while the nav is collapsed. A wrong grid width produces horizontal overflow or a squeezed screenshot.
2. **Arabic RTL**: the rail sits on the right, the action arrows point left, and the dropdown panel is not clipped by the header.
3. **Longest page (`schools.fr.md`)**: a three-line H1, a table and several card lists must keep a clear rhythm and not overflow.
4. **Pricing at 768 px**: the plan cards and comparison table stay wide and scroll horizontally; there is no empty TOC rail.
5. **English home**: the empty Solutions group disappears, Ressources remains, and no link points to a page that does not exist in English.

---

### Task 1: Navigation model, labels and markup

**Files:**
- Modify: `src/i18n/fr.json`, `src/i18n/ar.json`, `src/i18n/en.json`
- Modify: `src/page.html` (the `<header class="topbar">` block)
- Modify: `scripts/build.mjs` (`renderFragment`, after the `data-page` replacement)
- Modify: `scripts/content.mjs` (`siteLinks`, `topBar`, add `navGroups`)
- Test: `tests/landing.test.js`

**Interfaces:**
- `navGroups(lang, currentId, pageType)` returns an array of:
  - `{ kind: "link", label: string, href: string, current: boolean }`
  - `{ kind: "group", label: string, current: boolean, items: Array<{ label: string, href: string, current: boolean }> }`
- `renderTopNav(groups)` returns the `<nav class="cp-nav" ...>` block for a content page.
- `renderMobileNav(groups)` returns the `<details class="cp-mobile-menu">` block for a content page.
- Existing `t(lang, key, vars)`, `pageHref(id, lang)`, `home(lang)` and `packLabel(pack)` keep their signatures.
- Top-level elements carry `data-nav-top` so the tests can count them without parsing nested links.

- [ ] **Step 1: Write the failing test**

Add to `tests/landing.test.js`, near the home-page tests:

```js
test("the top navigation is short, translated and free of empty groups", async () => {
  const build = await loadBuild();
  const files = build.outputs();
  const content = build.contentPages();

  const fr = files["fr/fonctionnalites/emploi-du-temps/index.html"];
  const frNav = /<nav class="cp-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(fr)[1];
  assert.equal((frNav.match(/data-nav-top/g) || []).length, 5, "FR content nav: five top-level items");
  assert.ok(frNav.includes("Solutions") && frNav.includes("Ressources"), "FR nav: the two groups");
  assert.equal(frNav.includes("Tarifs détaillés"), false, "the duplicate pricing link is gone");
  assert.ok(frNav.includes(content.pageHref("schools", "fr")), "FR nav: schools");
  assert.ok(frNav.includes(content.pageHref("centers", "fr")), "FR nav: centres");

  const ar = files["ar/الميزات/جدول-الحصص/index.html"];
  const arNav = /<nav class="cp-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(ar)[1];
  assert.equal((arNav.match(/data-nav-top/g) || []).length, 5, "AR content nav: five top-level items");

  const en = files["en/index.html"];
  const enNav = /<nav class="nav-links"[^>]*>([\s\S]*?)<\/nav>/.exec(en)[1];
  assert.equal((enNav.match(/data-nav-top/g) || []).length, 4, "EN home: empty groups are hidden");
  assert.equal(/Solutions/.test(enNav), false, "EN has no empty Solutions group");
  assert.ok(enNav.includes("Resources"), "EN keeps Ressources");
  assert.equal(/href="\/en\/(ecoles|centres|tarifs|fonctionnalites)/.test(enNav), false, "EN nav has no dead content links");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test --test-name-pattern="short, translated"` from `D:\acadex`
Expected: FAIL — `data-nav-top` is absent and the old nav still has eight items.

- [ ] **Step 3: Add the dictionary keys**

Add the same keys to all three files, next to the existing `nav_*` and `cp_*` keys:

```json
"nav_solutions": "Solutions",
"nav_resources": "Ressources",
"cp_toc": "Sur cette page",
"cp_offline": "100 % hors ligne",
"cp_lifetime": "Licence à vie",
"cp_pack_chip": "Pack {pack}",
"cp_rail_pack": "Votre pack",
"cp_menu": "Menu",
"cp_free_demo": "Démo gratuite",
"cp_no_payment": "Aucun paiement à la commande",
"cp_trust_lifetime": "Licence à vie pour un PC"
```

Arabic values: `الحلول`, `الموارد`, `في هذه الصفحة`, `يعمل دون إنترنت`,
`ترخيص مدى الحياة`, `باقة {pack}`, `باقتك`, `القائمة`, `عرض تجريبي مجاني`,
`لا دفع عند الطلب`, `ترخيص مدى الحياة لجهاز واحد`.
English values: `Solutions`, `Resources`, `On this page`, `100% offline`,
`Lifetime licence`, `{pack} pack`, `Your pack`, `Menu`, `Free demo`,
`No payment at order`, `Lifetime licence for one PC`.

- [ ] **Step 4: Replace the home navigation markup**

In `src/page.html`, replace the eight links inside `<nav class="nav-links" id="nav-links">` with:

```html
<a href="#features" data-nav-top data-i18n="nav_features">الميزات</a>
<a href="#plans" data-nav-top data-i18n="nav_plans">الباقات</a>
<details class="nav-drop" data-nav-top>
  <summary class="nav-drop-btn">
    <span data-i18n="nav_solutions">Solutions</span>
    <svg class="nav-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </summary>
  <div class="nav-drop-menu">
    <a data-page="schools" href="#" data-i18n="cp_nav_schools">Écoles privées</a>
    <a data-page="centers" href="#" data-i18n="cp_nav_centers">Centres de soutien</a>
  </div>
</details>
<details class="nav-drop" data-nav-top>
  <summary class="nav-drop-btn">
    <span data-i18n="nav_resources">Ressources</span>
    <svg class="nav-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </summary>
  <div class="nav-drop-menu">
    <a href="#compare" data-i18n="nav_compare">Comparatif</a>
    <a href="#faq" data-i18n="nav_faq">FAQ</a>
    <a data-page="blog" href="#" data-i18n="cp_nav_blog">Blog</a>
  </div>
</details>
<a href="#contact" data-nav-top data-i18n="nav_contact">تواصل</a>
```

Do not put `data-i18n` on `<summary>` itself: the build would replace its inner HTML and delete the chevron.

- [ ] **Step 5: Drop empty groups in `scripts/build.mjs`**

Immediately after the `data-page` replacement in `renderFragment`, add:

```js
// A dropdown whose links were all removed for this language is not published.
html = html.replace(/[ \t]*<details class="nav-drop"[\s\S]*?<\/details>\n?/g, (block) =>
  /<div class="nav-drop-menu">[\s\S]*?<a\b/.test(block) ? block : "");
```

- [ ] **Step 6: Generate the content-page navigation in `scripts/content.mjs`**

Add `navGroups`, `renderTopNav` and `renderMobileNav` near `siteLinks`. Use `currentId` and `pageType`:

```js
function navGroups(lang, currentId, pageType) {
  const groups = [];
  groups.push({ kind: "link", label: t(lang, "nav_features"), href: home(lang) + "#features", current: pageType === "feature" });
  groups.push({ kind: "link", label: t(lang, "nav_plans"), href: pageHref("pricing", lang) || home(lang) + "#plans", current: currentId === "pricing" });
  const solutions = [
    ["schools", t(lang, "cp_nav_schools")],
    ["centers", t(lang, "cp_nav_centers")],
  ].map(([id, label]) => ({ label, href: pageHref(id, lang), current: currentId === id })).filter((item) => item.href);
  if (solutions.length) groups.push({ kind: "group", label: t(lang, "nav_solutions"), current: solutions.some((item) => item.current), items: solutions });
  const resources = [
    { label: t(lang, "nav_compare"), href: home(lang) + "#compare", current: false },
    { label: t(lang, "nav_faq"), href: home(lang) + "#faq", current: false },
    { label: t(lang, "cp_nav_blog"), href: pageHref("blog", lang), current: currentId === "blog" },
  ].filter((item) => item.href);
  if (resources.length) groups.push({ kind: "group", label: t(lang, "nav_resources"), current: resources.some((item) => item.current), items: resources });
  groups.push({ kind: "link", label: t(lang, "nav_contact"), href: home(lang) + "#contact", current: false });
  return groups;
}
```

`renderTopNav(groups)` emits `<nav class="cp-nav">`; each link gets `data-nav-top`; each group emits the same `<details class="nav-drop">` / `<summary class="nav-drop-btn">` / `<div class="nav-drop-menu">` structure as the home page. Add `is-current` and `aria-current="page"` to the current top-level item or group summary, and to the current nested link.

`renderMobileNav(groups)` emits:

```html
<details class="cp-mobile-menu">
  <summary class="cp-menu-btn"><span>Menu</span><svg class="nav-chevron" ...></svg></summary>
  <div class="cp-mobile-panel">
    ...top-level links...
    <p class="cp-mobile-group">Solutions</p>
    ...nested links with class="cp-mobile-sub"...
  </div>
</details>
```

Make `topBar(lang, alts, pack, currentId, pageType)` use `renderTopNav(navGroups(...))` and `renderMobileNav(navGroups(...))`. Keep the language switcher and the order button in `.cp-top-actions`.

- [ ] **Step 7: Pass the current page to `topBar`**

In `renderPage`, call `topBar(lang, alts, pack, page.id, page.meta.type)`.
In `renderBlogIndex`, call `topBar(lang, alts, "complet", "blog", "blog")`.
Leave `siteLinks` and the footer unchanged; the footer may keep the longer list.

- [ ] **Step 8: Run the tests**

Run: `node --test --test-name-pattern="short, translated"`
Expected: PASS.
Run: `node --test`
Expected: all tests pass (63 existing plus the new one).

- [ ] **Step 9: Build and inspect the raw nav**

Run: `node scripts/build.mjs`
Expected: generated files written.
Check `fr/index.html`, `ar/index.html`, `en/index.html` and one content page: five top-level items in FR/AR, four in EN, no empty dropdown, `href` values point to existing pages.

- [ ] **Step 10: Commit**

```bash
git add src/i18n/fr.json src/i18n/ar.json src/i18n/en.json src/page.html scripts/build.mjs scripts/content.mjs tests/landing.test.js fr ar en sitemap.xml
git commit -m "feat(nav): five-item navigation with solutions and resources menus"
```

---

### Task 2: Content-page shell, section anchors and action links

**Files:**
- Modify: `scripts/content.mjs` (`markdown`, `renderPage`, `callToAction`, `related`; add `actionLink` and `arrowIcon`)
- Test: `tests/landing.test.js`

**Interfaces:**
- `markdown(source, page)` returns `{ html, faq, sections }`, where `sections` is `Array<{ id: string, label: string }>` with IDs `section-1`, `section-2`, …
- `actionLink(label, target, page)` returns a `<a class="cp-action-link">` containing `<span class="cp-arrow">` (SVG) and resolves `target` through `linkTarget`.
- Generated content-page classes: `.cp-hero-with-media`, `.cp-hero-meta`, `.cp-chip`, `.cp-layout`, `.cp-rail`, `.cp-toc`, `.cp-toc-mobile`, `.cp-link-row`, `.cp-action-link`, `.cp-pricing-page`, `.cp-cta-chips`, and related-card markup.

- [ ] **Step 1: Write the failing tests**

Add to `tests/landing.test.js`:

```js
test("a content page has anchored sections, a table of contents and a media hero", async () => {
  const build = await loadBuild();
  const content = build.contentPages();
  const files = build.outputs();
  for (const id of ["schools", "centers", "attendance", "timetable", "receipts", "payroll"]) {
    const page = content.find(id, "fr");
    const html = files[content.fileOf(page)];
    assert.ok(html.includes('class="cp-hero cp-hero-with-media"'), `${id}: media hero`);
    assert.ok(html.includes('<aside class="cp-rail">'), `${id}: rail`);
    assert.ok(html.includes('<nav class="cp-toc"'), `${id}: table of contents`);
    assert.ok(html.includes('class="cp-chip"'), `${id}: meta chip`);
    const ids = [...html.matchAll(/<h2 id="(section-\d+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 2, `${id}: at least two sections`);
    assert.equal(new Set(ids).size, ids.length, `${id}: unique section ids`);
    for (const section of ids) assert.ok(html.includes(`href="#${section}"`), `${id}: TOC target ${section}`);
    assert.equal(/<button\b|data-i18n/.test(html), false, `${id}: no page controls`);
  }
});

test("pricing keeps the wide plan grid and has no TOC rail", async () => {
  const build = await loadBuild();
  const content = build.contentPages();
  const html = build.outputs()[content.fileOf(content.find("pricing", "fr"))];
  assert.ok(html.includes("cp-pricing-page"), "pricing marker");
  assert.ok(html.includes('id="plans"'), "plans section");
  assert.ok(html.includes("cp-pricing"), "plan grid");
  assert.equal(html.includes('<nav class="cp-toc"'), false, "no TOC on pricing");
});

test("a paragraph that is only a link becomes an action row", async () => {
  const build = await loadBuild();
  const content = build.contentPages();
  const html = build.outputs()[content.fileOf(content.find("schools", "fr"))];
  assert.ok(html.includes('class="cp-link-row"'), "standalone link row");
  assert.ok(html.includes('class="cp-action-link"'), "action link");
  assert.ok(html.includes(content.pageHref("receipts", "fr")), "action link target");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test --test-name-pattern="anchored sections|wide plan grid|action row"`
Expected: FAIL — no `cp-hero-with-media`, `cp-rail`, section IDs or `cp-link-row`.

- [ ] **Step 3: Add section IDs to `markdown`**

In `markdown`, create `const sections = [];` next to `faq`. Replace the `## ` branch with:

```js
if (line.startsWith("## ")) {
  const source = line.slice(3).trim();
  const id = `section-${sections.length + 1}`;
  sections.push({ id, label: stripTags(inline(source, page)).trim() });
  html.push(`<h2 id="${id}">${inline(source, page)}</h2>`);
  i += 1;
  continue;
}
```

Return `{ html: html.join("\n"), faq, sections }`.

- [ ] **Step 4: Render standalone links as action rows**

Add `arrowIcon` and `actionLink` near `inline`:

```js
const arrowIcon = '<svg class="cp-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function actionLink(label, target, page) {
  const link = linkTarget(target.replace(/&amp;/g, "&"), page);
  const attrs = link.external ? ' target="_blank" rel="noopener"' : "";
  return `<a class="cp-action-link" href="${escapeAttr(link.href)}"${attrs}><span>${escapeHtml(label)}</span>${arrowIcon}</a>`;
}
```

In the paragraph branch, before pushing a normal `<p>`, test the raw paragraph:

```js
const paragraphText = paragraph.join(" ").trim();
const onlyLink = /^\[([^\]]+)\]\(([^)\s]+)\)\.?$/.exec(paragraphText);
if (onlyLink) {
  html.push(`<p class="cp-link-row">${actionLink(onlyLink[1], onlyLink[2], page)}</p>`);
} else {
  html.push(`<p>${inline(paragraphText, page)}</p>`);
}
```

- [ ] **Step 5: Build the new hero**

In `renderPage`, keep the breadcrumb. Replace the old hero block with:

```js
'<header class="cp-hero' + (image ? " cp-hero-with-media" : "") + '">',
'  <div class="cp-hero-copy">',
page.meta.kicker ? `    <p class="cp-kicker">${escapeHtml(page.meta.kicker)}</p>` : "",
`    <h1>${escapeHtml(page.meta.h1)}</h1>`,
page.meta.lead ? `    <p class="cp-lead">${inline(page.meta.lead, page)}</p>` : "",
chips ? `    <p class="cp-hero-meta">${chips}</p>` : "",
dateLine,
isArticle ? "" : `    <div class="cp-hero-btns"><a class="btn-primary" href="${home(lang)}#order-${pack}">${escapeHtml(t(lang, "cp_order_pack", { pack: packLabel(pack) }))}</a><a class="btn-secondary" href="${escapeAttr(waLink(lang))}" target="_blank" rel="noopener">${escapeHtml(t(lang, "m_wa"))}</a></div>`,
'  </div>',
image ? `  <div class="cp-hero-media">${image}</div>` : "",
'</header>',
```

Build `chips` for non-articles:

```js
const chips = !isArticle ? [
  `<span class="cp-chip">${escapeHtml(t(lang, "cp_pack_chip", { pack: packLabel(pack) }))}</span>`,
  `<span class="cp-chip">${escapeHtml(t(lang, "cp_offline"))}</span>`,
  `<span class="cp-chip">${escapeHtml(t(lang, "cp_lifetime"))}</span>`,
].join("") : "";
```

The existing `image` variable already contains `<figure class="cp-shot">…</figure>`; move it into the media column and do not render it again below the hero.

- [ ] **Step 6: Build the TOC, rail and layout**

Use `sections` from `markdown`. Build the TOC links once:

```js
const tocItems = sections.map((section, index) =>
  `<li><a href="#${section.id}"><span class="cp-toc-num">${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(section.label)}</span></a></li>`).join("");
const toc = !isPricing && sections.length >= 2
  ? `<nav class="cp-toc" aria-label="${escapeAttr(t(lang, "cp_toc"))}"><p class="cp-toc-title">${escapeHtml(t(lang, "cp_toc"))}</p><ol>${tocItems}</ol></nav>`
  : "";
const mobileToc = toc ? `<details class="cp-toc-mobile"><summary>${escapeHtml(t(lang, "cp_toc"))}</summary>${toc}</details>` : "";
```

Build the pack card for segment and feature pages:

```js
const price = priceTable(lang)[pack].formatted;
const packCard = !isArticle && !isPricing
  ? `<div class="cp-rail-card"><p class="cp-rail-eyebrow">${escapeHtml(t(lang, "cp_rail_pack"))}</p><p class="cp-rail-pack">${escapeHtml(packLabel(pack))}</p><p class="cp-rail-price">${escapeHtml(price)}</p><p class="cp-rail-note">${escapeHtml(t(lang, "cp_lifetime"))}</p><a class="cp-rail-order" href="${home(lang)}#order-${pack}">${escapeHtml(t(lang, "cp_order"))}</a></div>`
  : "";
```

Assemble:

```js
const contentColumn = [mobileToc, `<div class="cp-body">\n${bodyHtml}\n</div>`, faqBlock(lang, faq), callToAction(lang, pack, { pricing: !isPricing }), related(page)].filter(Boolean).join("\n");
const layout = toc
  ? `<div class="cp-layout"><aside class="cp-rail">${toc}${packCard}</aside><div class="cp-main">${contentColumn}</div></div>`
  : `<div class="cp-main cp-main-wide">${contentColumn}</div>`;
```

Replace the old sequential `cp-body` / FAQ / CTA / related with `${layout}`.

- [ ] **Step 7: Mark the pricing page and upgrade CTA/related cards**

Change the main line to:

```js
`<main class="cp${isPricing ? " cp-wide cp-pricing-page" : ""}">`
```

In `callToAction`, add before the buttons:

```js
'  <div class="cp-cta-chips">',
`    <span>${escapeHtml(t(lang, "cp_free_demo"))}</span>`,
`    <span>${escapeHtml(t(lang, "cp_no_payment"))}</span>`,
`    <span>${escapeHtml(t(lang, "cp_trust_lifetime"))}</span>`,
'  </div>',
```

In `related`, render each item as a card:

```js
`    <li><a href="${href}"><span>${escapeHtml(label)}</span>${arrowIcon}</a></li>`
```

- [ ] **Step 8: Run the tests**

Run: `node --test --test-name-pattern="anchored sections|wide plan grid|action row"`
Expected: PASS.
Run: `node --test`
Expected: all tests pass. Pay attention to the existing "one heading", "no script", "every internal link" and "FAQ data" tests.

- [ ] **Step 9: Commit**

```bash
git add scripts/content.mjs tests/landing.test.js fr ar en sitemap.xml
git commit -m "feat(content): editorial shell with hero, table of contents and action links"
```

---

### Task 3: Visual system — navbar, dropdowns and content-page CSS

**Files:**
- Modify: `assets/site.css` (navbar block near `/* ── Navbar ── */`; replace the content-page block from `/* ── Content pages … */` to the final content-page media query)
- Modify: `assets/site.js` only if the home dropdown needs sibling-closing behaviour
- Test: no new unit test; verify with the build and screenshots

**Interfaces:**
- Uses the classes from Tasks 1–2: `.nav-drop`, `.nav-drop-btn`, `.nav-drop-menu`, `.nav-chevron`, `.cp-mobile-menu`, `.cp-menu-btn`, `.cp-mobile-panel`, `.cp-mobile-group`, `.cp-mobile-sub`, `.cp-hero`, `.cp-hero-with-media`, `.cp-hero-copy`, `.cp-hero-media`, `.cp-hero-meta`, `.cp-chip`, `.cp-layout`, `.cp-rail`, `.cp-toc`, `.cp-toc-mobile`, `.cp-toc-title`, `.cp-toc-num`, `.cp-rail-card`, `.cp-main`, `.cp-link-row`, `.cp-action-link`, `.cp-arrow`, `.cp-cta-chips`, `.cp-pricing-page`.

- [ ] **Step 1: Replace the navbar styles**

Keep the existing topbar blur and brand. Set the nav to one line:

- `.topbar-in`: `max-width: 1160px; padding: 12px 24px; gap: 20px;`
- `.nav-links`: `display:flex; align-items:center; gap:20px; white-space:nowrap; font-size:13.5px;`
- `.nav-links > a`, `.nav-drop-btn`: inline-flex, `min-height: 36px`, muted text, hover white.
- `.nav-drop`: `position: relative;`
- `.nav-drop-btn`: `list-style:none; cursor:pointer; display:inline-flex; align-items:center; gap:5px; padding:8px 0;`
- `.nav-drop-btn::-webkit-details-marker { display:none; }`
- `.nav-chevron`: `transition: transform var(--transition);` rotate 180° when `[open]`.
- `.nav-drop[open] > .nav-drop-btn`, `.nav-drop[data-current="true"] > .nav-drop-btn`: white; current also gets a subtle blue pill.
- `.nav-drop-menu`: absolute, `top: calc(100% + 10px); inset-inline-start: 0; min-width: 220px; padding: 8px; background:#0B0F19; border:1px solid var(--border-light); border-radius:14px; box-shadow:0 24px 50px -20px rgba(0,0,0,.85); display:grid; gap:2px; z-index:120;`
- `.nav-drop-menu a`: padding 10px 12px, radius 9px, muted, hover background and white.
- At `max-width: 1080px`: show `.nav-toggle`, hide `.nav-links` unless `.open`, stack the menu, make `.nav-drop-menu` static with no border/background, and indent nested links. Remove the duplicated nav rules from the existing `max-width: 780px` block so the nav collapses at 1080 and the rest of the mobile layout stays at 780.

- [ ] **Step 2: Add the content-page top bar**

- `.cp-top`: sticky, translucent, border-bottom, `position: relative`.
- `.cp-top-in`: max-width 1160px, padding 12px 24px, flex, gap 20px, `flex-wrap: nowrap`.
- `.cp-nav`: flex, gap 22px, `white-space: nowrap`, overflow visible on desktop.
- `.cp-nav > a`, `.cp-nav .nav-drop-btn`: current style with `.is-current` or `[aria-current="page"]` using a subtle blue pill.
- `.cp-mobile-menu`: hidden on desktop; at `max-width: 1079px` hide `.cp-nav`, show `.cp-mobile-menu`, and position `.cp-mobile-panel` as an absolute panel under the header (`top: 100%; inset-inline: 0`), with stacked links and group labels.
- At `max-width: 760px`: keep the header on one line, hide `.cp-top-order`, keep brand + menu + language pills.

- [ ] **Step 3: Replace the content-page body styles**

Use the existing tokens. Key values:

- `.cp`: max-width 1160px, `padding: 24px 24px 80px`.
- `.cp-hero`: grid with one column; optional media grid `grid-template-columns: minmax(0, 1fr) minmax(360px, 0.85fr); gap: 48px; align-items: center;` with a soft radial blue/gold background glow (pseudo-elements, no images).
- `.cp-hero h1`: `clamp(30px, 4.6vw, 46px)`, 900, line-height 1.15, letter-spacing -0.02em, max 22ch.
- `.cp-kicker`: pill with a blue dot; `.cp-hero-meta`: flex wrap chips; `.cp-chip`: 12px, border, muted, radius full.
- `.cp-shot`: no outer margins in the hero; frame with 1px border, radius 18px, gradient background, shadow; image radius 12px; figcaption centered 13px.
- `.cp-layout`: `display:grid; grid-template-columns: 210px minmax(0, 660px); gap: 48px; max-width: 918px; margin: 0 auto; align-items:start;`
- `.cp-rail`: `position: sticky; top: 96px; display:grid; gap:14px;`
- `.cp-toc`: card with border, background, radius, padding; title 12px uppercase muted; ordered list with counters; links flex, gap 10, padding 7px 8px, radius 8, hover background; number 11px blue.
- `.cp-toc-mobile`: hidden on desktop; at `max-width: 959px` show it and hide `.cp-rail`, make `.cp-layout` one column, and set `.cp-body` max-width 660px.
- `.cp-body`: 17.5px, line-height 1.78, color `#C7D2E0`, max-width 660px; h2 26–28px with CSS counter (`counter-reset: cp-section`; `counter-increment`; `::before` shows `01`, `02` in blue) and a top hairline except for the first h2; h3 19px white; paragraphs 16–18px bottom margin.
- Lists: `ul` no bullets, grid gap 8; `li` card with 1px border, subtle background, radius 12, `padding-block: 12px`, `padding-inline: 44px 16px`; `li::before` is a ✓ in a small blue circle at `inset-inline-start: 14px`. `ol` uses numbered circles with a CSS counter. Keep `strong` white.
- Tables: `.cp-table` rounded border, `border-collapse: collapse`, uppercase muted header, row separators, hover row.
- Links: `.cp-body a:not(.cp-action-link)`, `.cp-faq a`, `.cp-link`, `.cp-pricing-note a` get `color:#93C5FD; text-decoration:none; border-bottom:1px solid rgba(147,197,253,.28);` hover/focus use `#DBEAFE` and a solid border. Remove the old permanent `text-decoration: underline` from this group.
- `.cp-link-row`: margin 18px 0; `.cp-action-link`: inline-flex, gap 10, padding 10px 16px, border 1px solid rgba(59,130,246,.35), radius 999px, background rgba(59,130,246,.1), color primary-light, font-weight 700, no bottom border; hover background stronger. `.cp-arrow` is 18px; `[dir="rtl"] .cp-arrow { transform: scaleX(-1); }`.
- FAQ: cards with 1px border, radius 14, background card; summary flex with `::after` showing `+` / `−`; open state border blue and background slightly lighter; answer padding.
- Related: `ul` grid two columns, gap 12; each `li` card; `a` flex `justify-content:space-between`, padding 16px, white title, arrow on hover.
- CTA: keep the gradient panel; add `.cp-cta-chips` flex wrap with small bordered pills; buttons under it.
- Pricing: `.cp-pricing-page .cp-body { max-width: 720px; margin-inline: auto; }`; do not apply the rail layout; keep `.cp-pricing` and the comparison table at full width.
- Blog index: `.cp-posts` two columns at desktop, one at 760px.

- [ ] **Step 4: Build and take the first screenshots**

Run: `node scripts/build.mjs`
Start the preview in the background: `node scripts/preview.mjs`
Capture with Chrome headless (use a fresh profile per shot):

```powershell
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tmp = "C:\Users\Ncib\AppData\Local\Temp\opencode\acadex-redesign"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--disable-gpu','--hide-scrollbars',"--user-data-dir=$tmp\p1", "--screenshot=$tmp\schools-1440.png", '--window-size=1440,2400', 'http://localhost:4173/fr/ecoles-privees/') -Wait -NoNewWindow
Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--disable-gpu','--hide-scrollbars',"--user-data-dir=$tmp\p2", "--screenshot=$tmp\timetable-1440.png", '--window-size=1440,2400', 'http://localhost:4173/fr/fonctionnalites/emploi-du-temps/') -Wait -NoNewWindow
```

Open both PNGs with the `read` tool. Check: one-line nav, two-column hero, framed screenshot, TOC rail, numbered sections, check-card list, calmer links, FAQ cards, related cards, CTA chips.

- [ ] **Step 5: Fix visual defects, then check the small widths**

Repeat screenshots at 1280, 1024, 960, 768 and 390 px for the schools page, and at 390 px for `/ar/ecoles-privees/` (Arabic URL from the built tree). Check the Review Focus items. Iterate on CSS until:
- no horizontal overflow at any width;
- the nav is one line at 1280 and 1440;
- the rail disappears at 959 px and the TOC details appears;
- Arabic arrows point left and the rail is on the right;
- pricing at 768 px scrolls the table, not the page.

- [ ] **Step 6: Commit**

```bash
git add assets/site.css assets/site.js
git commit -m "style(content): finish the navbar and reading layout"
```

---

### Task 4: Home dropdown behaviour, full verification and generated files

**Files:**
- Modify: `assets/site.js` (home nav dropdowns only)
- Verify: `tests/landing.test.js`, `fr/`, `ar/`, `en/`, `sitemap.xml`
- Do not add script to content pages.

**Interfaces:**
- Uses `.nav-drop` elements from Task 1. Content pages must remain functional without this script.

- [ ] **Step 1: Close sibling dropdowns on the home page**

In the mobile-menu block of `assets/site.js`, after the existing `navToggle` listeners, add:

```js
const navDrops = [...document.querySelectorAll(".nav-links .nav-drop")];
navDrops.forEach((drop) => {
  drop.addEventListener("toggle", () => {
    if (!drop.open) return;
    navDrops.forEach((other) => { if (other !== drop) other.open = false; });
  });
});
document.addEventListener("click", (event) => {
  navDrops.forEach((drop) => { if (!drop.contains(event.target)) drop.open = false; });
});
```

Keep this code guarded by the existing element checks if `navToggle` is absent on a page (content pages do not load `site.js`).

- [ ] **Step 2: Build and run the full suite**

Run: `node scripts/build.mjs`
Expected: every generated page written, no build error.
Run: `node --test`
Expected: all tests pass, including the new nav, section, pricing and action-link tests.
Run: `node scripts/build.mjs --check`
Expected: exit code 0, no stale published file.

- [ ] **Step 3: Run the full visual matrix**

For each page and width, capture and inspect:

| Page | Widths |
|---|---|
| `/fr/ecoles-privees/` | 1440, 1280, 1080, 1024, 960, 768, 390 |
| `/fr/fonctionnalites/emploi-du-temps/` | 1440, 1024, 390 |
| `/ar/ecoles-privees/` | 1440, 390 |
| `/fr/tarifs/` | 1280, 768 |
| `/fr/` (home) | 1440, 1280, 1080, 1024, 390 |

Check every Review Focus item. If a defect appears, fix the CSS/template, rebuild, and re-shoot that width before moving on.

- [ ] **Step 4: Check the HTML constraints directly**

Run a quick grep on the generated content pages:

```powershell
Select-String -Path D:\acadex\fr\ecoles-privees\index.html -Pattern '<button|data-i18n|data-order-pack'
```

Expected: no matches.
Check that the EN home has no Solutions group and no link to `/en/ecoles-privees/`.

- [ ] **Step 5: Final build, test and commit**

```bash
node scripts/build.mjs
node --test
node scripts/build.mjs --check
git add assets/site.js fr ar en sitemap.xml
git commit -m "chore: publish the content redesign"
```

- [ ] **Step 6: Report**

Send the owner:
- the final before/after screenshots;
- the test count and `--check` result;
- the file list changed;
- any visual call not covered by the spec.

---

## Self-Review Notes

- Spec coverage: nav model (§6.1) → Task 1; content shell and links (§6.2) → Task 2; typography, navbar, responsive (§6.3, §6.8) → Task 3; accessibility/SEO constraints → Tasks 1–4; performance → Task 3 (CSS only); acceptance → Task 4.
- The pricing special case is implemented by `cp-pricing-page` + no TOC in Task 2, and by the full-width plan grid in Task 3.
- The EN four-item nav is covered by the Task 1 test and the empty-group removal in `renderFragment`.
- No copy files are touched; `src/pages/*.md` is absent from every task.
