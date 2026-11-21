// Content pages: segment pages, feature pages, the pricing page and the blog.
//
// Each page is a Markdown file, src/pages/<id>.<lang>.md, with a few lines of
// settings on top. Two files with the same <id> are the same page in two
// languages (they name each other with hreflang). The address of a page is
// /<lang>/<slug>/, the slug being written in the page's own language.
//
//   ---
//   slug: ecoles-privees          address of the page, after /<lang>/
//   type: segment                 segment | feature | pricing | article
//   title: …                      <title>, 50–60 characters
//   description: …                meta description, 140–155 characters
//   h1: …                         the page's heading
//   crumb: …                      short name in the breadcrumb (default: the heading)
//   lead: …                       one or two sentences under the heading
//   kicker: …                     small label above the heading
//   image: assets/shots/x.webp    screenshot shown under the heading (optional)
//   image_alt: …                  what the screenshot shows
//   pack: complet                 the pack the order button opens
//   related: pricing, schools     pages linked at the bottom (ids)
//   status: draft                 a draft is not published (default: published)
//   date: 2026-11-21              articles only
//   ---
//
// Body: ## and ### headings, paragraphs, - and 1. lists, > notes, | tables |,
// **bold**, [links](target). Link targets: page:<id>, home:#anchor,
// order:<pack>, wa:demo, /download, or a full address. {price:plus} writes the
// current price of a pack. A block between « ::: faq » and « ::: » holds
// questions (### lines) and their answers: it is also given to search engines.
import fs from "node:fs";
import path from "node:path";

const TYPES = ["segment", "feature", "pricing", "article"];

export function createContent(ctx) {
  const { ROOT, LANGS, DIR, OG_LOCALE, config, dictionaries, asset, escapeHtml, escapeAttr, stripTags, text, priceTable, readText, renderFragment, MAIN_FONT, analyticsTag } = ctx;
  const SOURCE = path.join(ROOT, "src", "pages");
  const includeDrafts = Boolean(ctx.includeDrafts);

  // ── Reading the sources ───────────────────────────────────────

  function parseSource(file) {
    const match = /^(.+)\.([a-z]{2})\.md$/.exec(file);
    if (!match || !LANGS.includes(match[2])) throw new Error(`src/pages/${file}: expected <id>.<lang>.md`);
    const raw = readText(`src/pages/${file}`);
    const parts = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    if (!parts) throw new Error(`src/pages/${file}: missing the settings block (--- … ---)`);
    const meta = {};
    for (const line of parts[1].split("\n")) {
      if (!line.trim()) continue;
      const entry = /^([a-z][a-z0-9_]*):\s*(.*)$/.exec(line);
      if (!entry) throw new Error(`src/pages/${file}: unreadable setting « ${line} »`);
      meta[entry[1]] = entry[2].trim();
    }
    for (const key of ["slug", "type", "title", "description", "h1"]) {
      if (!meta[key]) throw new Error(`src/pages/${file}: « ${key} » is required`);
    }
    if (!TYPES.includes(meta.type)) throw new Error(`src/pages/${file}: unknown type « ${meta.type} »`);
    if (meta.type === "article" && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date || "")) throw new Error(`src/pages/${file}: an article needs a date (YYYY-MM-DD)`);
    // An article lives under the blog of its language: /fr/blog/<name>/.
    const blog = { fr: "blog", ar: "المدونة", en: "blog" }[match[2]];
    if ((meta.type === "article") !== meta.slug.startsWith(`${blog}/`)) throw new Error(`src/pages/${file}: only articles, and every article, have a slug starting with « ${blog}/ »`);
    return {
      id: match[1],
      lang: match[2],
      file: `src/pages/${file}`,
      meta,
      body: parts[2],
      draft: (meta.status || "published") === "draft",
      slug: meta.slug.replace(/^\/+|\/+$/g, ""),
    };
  }

  const all = fs.existsSync(SOURCE) ? fs.readdirSync(SOURCE).filter((file) => file.endsWith(".md")).sort().map(parseSource) : [];
  const pages = all.filter((page) => includeDrafts || !page.draft);
  const find = (id, lang) => pages.find((page) => page.id === id && page.lang === lang) || null;

  /** Whether a language has a blog to show: at least one article that is published. */
  const articles = (lang) => pages.filter((page) => page.lang === lang && page.meta.type === "article")
    .sort((a, b) => (a.meta.date < b.meta.date ? 1 : a.meta.date > b.meta.date ? -1 : a.id.localeCompare(b.id)));
  const BLOG_SLUG = { fr: "blog", ar: "المدونة", en: "blog" };
  const hasBlog = (lang) => articles(lang).length > 0;

  // ── Addresses ────────────────────────────────────────────────

  const encodePath = (value) => value.split("/").map(encodeURIComponent).join("/");
  const home = (lang, full = false) => `${full ? config.origin : ""}/${lang}/`;
  const urlOf = (page, full = false) => `${home(page.lang, full)}${encodePath(page.slug)}/`;
  const blogUrl = (lang, full = false) => `${home(lang, full)}${encodePath(BLOG_SLUG[lang])}/`;
  const fileOf = (page) => `${page.lang}/${page.slug}/index.html`;

  /** The address of a page (by id) in a language, or null when that language does not have it. */
  function pageHref(id, lang) {
    if (id === "blog") return hasBlog(lang) ? blogUrl(lang) : null;
    const page = find(id, lang);
    return page ? urlOf(page) : null;
  }

  const t = (lang, key, vars = {}) => {
    let value = stripTags(text(lang, key));
    for (const name in vars) value = value.split(`{${name}}`).join(vars[name]);
    return value;
  };
  const waLink = (lang) => `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(t(lang, "wa_demo_msg"))}`;
  const packLabel = (pack) => pack[0].toUpperCase() + pack.slice(1);

  // ── Markdown (the small part of it these pages use) ──────────

  function linkTarget(target, page) {
    if (target.startsWith("page:")) {
      const href = pageHref(target.slice(5), page.lang);
      if (!href) throw new Error(`${page.file}: link to « ${target} », which has no ${page.lang} version`);
      return { href };
    }
    if (target.startsWith("home:")) return { href: home(page.lang) + target.slice(5) };
    if (target.startsWith("order:")) return { href: `${home(page.lang)}#order-${target.slice(6)}` };
    if (target === "wa:demo") return { href: waLink(page.lang), external: true };
    if (/^https?:\/\//.test(target)) return { href: target, external: true };
    if (target.startsWith("/")) return { href: target };
    throw new Error(`${page.file}: unknown link target « ${target} »`);
  }

  function inline(source, page) {
    const table = priceTable(page.lang);
    let out = escapeHtml(source);
    out = out.replace(/\{price:(essentiel|plus|complet)\}/g, (_, pack) => escapeHtml(table[pack].formatted));
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, target) => {
      const link = linkTarget(target.replace(/&amp;/g, "&"), page);
      return `<a href="${escapeAttr(link.href)}"${link.external ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
    });
    return out;
  }

  /** Renders a body. Returns the HTML and the questions of its FAQ block, if any. */
  function markdown(source, page) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    const faq = [];
    let i = 0;
    const isBlank = (line) => !line.trim();
    const startsBlock = (line) => /^(#{2,3} |- |\d+\. |> |\||:::)/.test(line);

    while (i < lines.length) {
      const line = lines[i];
      if (isBlank(line)) { i += 1; continue; }

      if (/^::: *faq\s*$/.test(line)) {
        i += 1;
        let question = null;
        let answer = [];
        const push = () => {
          if (question) faq.push({ question, answerHtml: answer.map((p) => `<p>${inline(p, page)}</p>`).join(""), answerText: answer.join(" ") });
          question = null;
          answer = [];
        };
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
          if (lines[i].startsWith("### ")) { push(); question = lines[i].slice(4).trim(); }
          else if (!isBlank(lines[i])) answer.push(lines[i].trim());
          i += 1;
        }
        push();
        i += 1;
        continue;
      }
      if (line.startsWith("## ")) { html.push(`<h2>${inline(line.slice(3).trim(), page)}</h2>`); i += 1; continue; }
      if (line.startsWith("### ")) { html.push(`<h3>${inline(line.slice(4).trim(), page)}</h3>`); i += 1; continue; }
      if (line.startsWith("- ")) {
        const items = [];
        while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2).trim()); i += 1; }
        html.push(`<ul>\n${items.map((item) => `  <li>${inline(item, page)}</li>`).join("\n")}\n</ul>`);
        continue;
      }
      if (/^\d+\. /.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, "").trim()); i += 1; }
        html.push(`<ol>\n${items.map((item) => `  <li>${inline(item, page)}</li>`).join("\n")}\n</ol>`);
        continue;
      }
      if (line.startsWith("> ")) {
        const quote = [];
        while (i < lines.length && lines[i].startsWith("> ")) { quote.push(lines[i].slice(2).trim()); i += 1; }
        html.push(`<p class="cp-note">${inline(quote.join(" "), page)}</p>`);
        continue;
      }
      if (line.startsWith("|")) {
        const rows = [];
        while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim())); i += 1; }
        const body = rows.filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell)));
        const [head, ...rest] = body;
        html.push([
          '<div class="cp-table"><table>',
          `<thead><tr>${head.map((cell) => `<th scope="col">${inline(cell, page)}</th>`).join("")}</tr></thead>`,
          `<tbody>${rest.map((row) => `<tr>${row.map((cell, index) => (index === 0 ? `<th scope="row">${inline(cell, page)}</th>` : `<td>${inline(cell, page)}</td>`)).join("")}</tr>`).join("")}</tbody>`,
          "</table></div>",
        ].join("\n"));
        continue;
      }
      const paragraph = [];
      while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) { paragraph.push(lines[i].trim()); i += 1; }
      html.push(`<p>${inline(paragraph.join(" "), page)}</p>`);
    }
    return { html: html.join("\n"), faq };
  }

  // ── The parts every content page shares ──────────────────────

  /** The other language versions of a page: [lang, absolute address]. */
  function alternates(page) {
    return LANGS.map((lang) => [lang, find(page.id, lang)]).filter(([, other]) => other).map(([lang, other]) => [lang, urlOf(other, true)]);
  }

  function head(lang, { title, description, url, alts, type, noindex }) {
    const image = config.origin + asset(`assets/og-${lang}.jpg`);
    const xDefault = (alts.find(([code]) => code === config.defaultLang) || alts[0] || [null, url])[1];
    return [
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeAttr(description)}">`,
      noindex ? '<meta name="robots" content="noindex">' : null,
      `<link rel="canonical" href="${url}">`,
      ...alts.map(([code, href]) => `<link rel="alternate" hreflang="${code}" href="${href}">`),
      alts.length ? `<link rel="alternate" hreflang="x-default" href="${xDefault}">` : null,
      `<link rel="icon" type="image/png" href="${asset("assets/logo-128.png")}">`,
      '<meta name="theme-color" content="#07090E">',
      `<meta property="og:type" content="${type === "article" ? "article" : "website"}">`,
      '<meta property="og:site_name" content="Acadex">',
      `<meta property="og:title" content="${escapeAttr(title)}">`,
      `<meta property="og:description" content="${escapeAttr(description)}">`,
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:locale" content="${OG_LOCALE[lang]}">`,
      `<meta property="og:image" content="${image}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${escapeAttr(t(lang, "og_image_alt"))}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escapeAttr(title)}">`,
      `<meta name="twitter:description" content="${escapeAttr(description)}">`,
      `<meta name="twitter:image" content="${image}">`,
      `<link rel="preload" as="font" type="font/woff2" href="/${MAIN_FONT[lang]}" crossorigin>`,
      `<link rel="stylesheet" href="${asset("assets/site.css")}">`,
      analyticsTag(),
    ].filter(Boolean).join("\n");
  }

  /** The language links of a page: its other versions, or that language's home page. */
  function langSwitcher(lang, alts) {
    const labels = { ar: "عربي", fr: "FR", en: "EN" };
    const links = LANGS.map((code) => {
      const alt = alts.find(([other]) => other === code);
      const href = code === lang ? "#top" : alt ? alt[1].replace(config.origin, "") : home(code);
      const current = code === lang ? ' class="lang-btn active" aria-current="page"' : ' class="lang-btn"';
      return `<a${current} data-lang="${code}" href="${href}" hreflang="${code}" lang="${code}">${labels[code]}</a>`;
    });
    return `<nav class="lang-switcher" aria-label="${escapeAttr(t(lang, "aria_lang"))}">\n        ${links.join("\n        ")}\n      </nav>`;
  }

  function siteLinks(lang) {
    return [
      [home(lang) + "#features", t(lang, "nav_features")],
      [pageHref("pricing", lang) || home(lang) + "#plans", t(lang, "nav_plans")],
      [pageHref("schools", lang), t(lang, "cp_nav_schools")],
      [pageHref("centers", lang), t(lang, "cp_nav_centers")],
      [pageHref("blog", lang), t(lang, "cp_nav_blog")],
      [home(lang) + "#contact", t(lang, "nav_contact")],
    ].filter(([href]) => href);
  }

  function topBar(lang, alts, pack) {
    return [
      '<header class="cp-top" id="top">',
      '  <div class="cp-top-in">',
      `    <a class="brand" href="${home(lang)}"><img src="${asset("assets/logo-128.png")}" alt="" class="brand-logo" width="34" height="34"><span class="brand-name">Acadex</span></a>`,
      `    <nav class="cp-nav" aria-label="${escapeAttr(t(lang, "aria_main_nav"))}">`,
      ...siteLinks(lang).map(([href, label]) => `      <a href="${href}">${escapeHtml(label)}</a>`),
      "    </nav>",
      '    <div class="cp-top-actions">',
      `      ${langSwitcher(lang, alts)}`,
      `      <a class="btn-primary cp-top-order" href="${home(lang)}#order-${pack}">${escapeHtml(t(lang, "cp_order"))}</a>`,
      "    </div>",
      "  </div>",
      "</header>",
    ].join("\n");
  }

  function footer(lang) {
    return [
      "<footer>",
      `  <nav class="footer-nav" aria-label="${escapeAttr(t(lang, "aria_footer_nav"))}">`,
      `    <a href="${home(lang)}">${escapeHtml(t(lang, "cp_home"))}</a>`,
      ...siteLinks(lang).map(([href, label]) => `    <a href="${href}">${escapeHtml(label)}</a>`),
      "  </nav>",
      '  <div class="footer-in">',
      `    <div><b>Acadex</b> — © 2026. <span>${escapeHtml(t(lang, "footer_copy"))}</span></div>`,
      "    <div>Windows 10 &amp; 11 · 64-bit</div>",
      "  </div>",
      "</footer>",
    ].join("\n");
  }

  function crumbs(lang, trail) {
    const items = trail.map(([label, href], index) => (index === trail.length - 1 || !href
      ? `<li aria-current="page">${escapeHtml(label)}</li>`
      : `<li><a href="${href}">${escapeHtml(label)}</a></li>`));
    return `<nav class="cp-crumbs" aria-label="${escapeAttr(t(lang, "cp_crumbs"))}"><ol>${items.join("")}</ol></nav>`;
  }

  /** The closing block of every page: a free demo, the order form, the prices. */
  function callToAction(lang, pack, { pricing = true } = {}) {
    const pricingHref = pricing ? pageHref("pricing", lang) || `${home(lang)}#plans` : null;
    return [
      '<aside class="cp-cta">',
      `  <h2>${escapeHtml(t(lang, "cp_cta_title"))}</h2>`,
      `  <p>${escapeHtml(t(lang, "cp_cta_text"))}</p>`,
      '  <div class="cp-cta-btns">',
      `    <a class="btn-primary" href="${home(lang)}#order-${pack}">${escapeHtml(t(lang, "cp_order_pack", { pack: packLabel(pack) }))}</a>`,
      `    <a class="btn-secondary" href="${escapeAttr(waLink(lang))}" target="_blank" rel="noopener">${escapeHtml(t(lang, "m_wa"))}</a>`,
      pricingHref ? `    <a class="cp-link" href="${pricingHref}">${escapeHtml(t(lang, "cp_see_pricing"))}</a>` : null,
      "  </div>",
      "</aside>",
    ].filter(Boolean).join("\n");
  }

  function faqBlock(lang, faq) {
    if (!faq.length) return "";
    return [
      '<section class="cp-faq">',
      `  <h2>${escapeHtml(t(lang, "cp_faq_title"))}</h2>`,
      ...faq.map((entry) => `  <details><summary>${escapeHtml(entry.question)}</summary>${entry.answerHtml}</details>`),
      "</section>",
    ].join("\n");
  }

  function related(page) {
    const ids = (page.meta.related || "").split(",").map((id) => id.trim()).filter(Boolean);
    const links = ids.map((id) => {
      const other = find(id, page.lang);
      if (id === "blog") return hasBlog(page.lang) ? [blogUrl(page.lang), t(page.lang, "cp_nav_blog")] : null;
      return other ? [urlOf(other), other.meta.h1] : null;
    }).filter(Boolean);
    if (!links.length) return "";
    return [
      `<nav class="cp-related" aria-label="${escapeAttr(t(page.lang, "cp_related"))}">`,
      `  <h2>${escapeHtml(t(page.lang, "cp_related"))}</h2>`,
      "  <ul>",
      ...links.map(([href, label]) => `    <li><a href="${href}">${escapeHtml(label)}</a></li>`),
      "  </ul>",
      "</nav>",
    ].join("\n");
  }

  const jsonLd = (graph) => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;
  const organization = () => ({ "@type": "Organization", "@id": `${config.origin}/#organization`, name: "Acadex", url: `${config.origin}/`, logo: `${config.origin}/assets/logo-512.png` });
  const breadcrumbList = (trail) => ({
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, href], index) => ({ "@type": "ListItem", position: index + 1, name, ...(href ? { item: href.startsWith("http") ? href : config.origin + href } : {}) })),
  });
  const faqPage = (url, lang, faq) => ({
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    inLanguage: lang,
    mainEntity: faq.map((entry) => ({ "@type": "Question", name: entry.question, acceptedAnswer: { "@type": "Answer", text: stripTags(entry.answerText.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")) } })),
  });

  function document(lang, headHtml, ldHtml, bodyHtml) {
    return ["<!DOCTYPE html>", `<html lang="${lang}" dir="${DIR[lang]}" class="dark">`, "<head>", headHtml, ldHtml, "</head>", '<body class="cp-page">', "", bodyHtml, "", "</body>", "</html>", ""].join("\n");
  }

  function fixTrail(lang, page) {
    const trail = [[t(lang, "cp_home"), home(lang)]];
    if (page.meta.type === "feature") trail.push([t(lang, "nav_features"), `${home(lang)}#features`]);
    if (page.meta.type === "article") trail.push([t(lang, "cp_nav_blog"), blogUrl(lang)]);
    trail.push([page.meta.crumb || page.meta.h1, urlOf(page)]);
    return trail;
  }

  // ── The pricing page: the plans of the home page, as a page of its own ──

  function pricingSection(lang) {
    const template = readText("src/page.html");
    const start = template.indexOf('<section id="plans"');
    const end = template.indexOf("</section>", start);
    if (start < 0 || end < 0) throw new Error("src/page.html: the #plans section was not found");
    let html = template.slice(start, end + "</section>".length);
    // Without the page script: no country picker, no pack filter above the table.
    const cut = (from, to) => {
      const a = html.indexOf(from);
      if (a < 0) throw new Error(`pricing page: « ${from} » not found in the #plans section`);
      const b = html.indexOf(to, a);
      html = html.slice(0, a) + html.slice(b + to.length);
    };
    cut('<div class="pricing-loc-hint"', "</div>");
    cut('<div class="cmp-tabs-wrap"', "</div>");
    // The order buttons become links to the order form of the home page.
    html = html.replace(/<button type="button" class="([^"]*)" data-order-pack="(essentiel|plus|complet)">([\s\S]*?)<\/button>/g,
      (_, classes, pack, inner) => `<a class="${classes}" href="${home(lang)}#order-${pack}">${inner}</a>`);
    if (/data-order-pack=|data-cmp-tab=/.test(html)) throw new Error("pricing page: a control that needs the page script is left");
    // The section keeps its heading (the pack names are sub-headings of it), not its label and intro.
    html = html.replace(/\s*<span class="sec-badge"[^>]*>[\s\S]*?<\/span>/, "").replace(/\s*<p class="sec-desc"[^>]*>[\s\S]*?<\/p>/, "");
    html = html.replace('<section id="plans" class="pricing-sec">', '<section id="plans" class="pricing-sec cp-pricing">');
    // No page script here: the hooks it would use to redraw a text are dropped.
    return renderFragment(html, lang).replace(/\sdata-i18n="[^"]*"/g, "").replace(/\sdata-price-template="[^"]*"/g, "");
  }

  // ── Pages ─────────────────────────────────────────────────────

  function renderPage(page) {
    const lang = page.lang;
    const url = urlOf(page, true);
    const alts = alternates(page);
    const pack = ["essentiel", "plus", "complet"].includes(page.meta.pack) ? page.meta.pack : "complet";
    const { html: bodyHtml, faq } = markdown(page.body, page);
    const trail = fixTrail(lang, page);
    const isArticle = page.meta.type === "article";
    const isPricing = page.meta.type === "pricing";

    const image = page.meta.image
      ? [
        '<figure class="cp-shot">',
        `  <img src="${asset(page.meta.image)}" alt="${escapeAttr(page.meta.image_alt || "")}" width="1280" height="710" fetchpriority="high" decoding="async">`,
        `  <figcaption>${escapeHtml(t(lang, "cp_shot_caption"))}</figcaption>`,
        "</figure>",
      ].join("\n")
      : "";
    if (page.meta.image && !page.meta.image_alt) throw new Error(`${page.file}: image_alt is required with an image`);

    const dateLine = isArticle
      ? `<p class="cp-date"><time datetime="${page.meta.date}">${escapeHtml(new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : lang, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${page.meta.date}T00:00:00Z`)))}</time></p>`
      : "";
    const draftBanner = page.draft ? `<p class="cp-draft">${escapeHtml(t(lang, "cp_draft"))}</p>` : "";

    const main = [
      topBar(lang, alts, pack),
      `<main class="cp${isPricing ? " cp-wide" : ""}">`,
      crumbs(lang, trail),
      draftBanner,
      "<article>",
      '<header class="cp-hero">',
      page.meta.kicker ? `  <p class="cp-kicker">${escapeHtml(page.meta.kicker)}</p>` : "",
      `  <h1>${escapeHtml(page.meta.h1)}</h1>`,
      page.meta.lead ? `  <p class="cp-lead">${inline(page.meta.lead, page)}</p>` : "",
      dateLine,
      isArticle ? "" : [
        '  <div class="cp-hero-btns">',
        `    <a class="btn-primary" href="${home(lang)}#order-${pack}">${escapeHtml(t(lang, "cp_order_pack", { pack: packLabel(pack) }))}</a>`,
        `    <a class="btn-secondary" href="${escapeAttr(waLink(lang))}" target="_blank" rel="noopener">${escapeHtml(t(lang, "m_wa"))}</a>`,
        "  </div>",
      ].join("\n"),
      "</header>",
      image,
      isPricing ? `<p class="cp-pricing-note">${escapeHtml(t(lang, "cp_pricing_note"))} <a href="${home(lang)}#plans">${escapeHtml(t(lang, "cp_pricing_note_link"))}</a></p>` : "",
      isPricing ? pricingSection(lang) : "",
      `<div class="cp-body">\n${bodyHtml}\n</div>`,
      faqBlock(lang, faq),
      "</article>",
      callToAction(lang, pack, { pricing: !isPricing }),
      related(page),
      "</main>",
      footer(lang),
    ].filter(Boolean).join("\n");

    const graph = [
      organization(),
      {
        "@type": isArticle ? "Article" : "WebPage",
        "@id": `${url}#${isArticle ? "article" : "webpage"}`,
        url,
        ...(isArticle
          ? { headline: page.meta.h1, datePublished: page.meta.date, dateModified: page.meta.updated || page.meta.date, author: { "@id": `${config.origin}/#organization` }, publisher: { "@id": `${config.origin}/#organization` }, mainEntityOfPage: url }
          : { name: page.meta.title }),
        description: page.meta.description,
        inLanguage: lang,
        image: page.meta.image ? `${config.origin}/${page.meta.image}` : `${config.origin}/assets/og-${lang}.jpg`,
        isPartOf: { "@type": "WebSite", "@id": `${config.origin}/#website`, url: `${config.origin}/`, name: "Acadex" },
      },
      breadcrumbList(trail),
    ];
    if (isPricing) {
      const table = priceTable(lang);
      graph.push({
        "@type": "SoftwareApplication",
        "@id": `${config.origin}/#software`,
        name: "Acadex",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Windows 10, Windows 11",
        url: home(lang, true),
        offers: ["essentiel", "plus", "complet"].map((name) => ({ "@type": "Offer", name: `Acadex ${packLabel(name)}`, price: String(table[name].amount), priceCurrency: table[name].currency, availability: "https://schema.org/InStock", url: `${home(lang, true)}#order-${name}` })),
      });
    }
    if (faq.length) graph.push(faqPage(url, lang, faq));

    return document(lang, head(lang, { title: page.meta.title, description: page.meta.description, url, alts, type: page.meta.type, noindex: page.draft }), jsonLd(graph), main);
  }

  function renderBlogIndex(lang) {
    const list = articles(lang);
    const url = blogUrl(lang, true);
    const alts = LANGS.filter(hasBlog).map((code) => [code, blogUrl(code, true)]);
    const trail = [[t(lang, "cp_home"), home(lang)], [t(lang, "cp_nav_blog"), blogUrl(lang)]];
    const format = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : lang, { dateStyle: "long", timeZone: "UTC" });
    const main = [
      topBar(lang, alts, "complet"),
      '<main class="cp">',
      crumbs(lang, trail),
      '<header class="cp-hero">',
      `  <h1>${escapeHtml(t(lang, "cp_blog_h1"))}</h1>`,
      `  <p class="cp-lead">${escapeHtml(t(lang, "cp_blog_lead"))}</p>`,
      "</header>",
      '<ul class="cp-posts">',
      ...list.map((post) => [
        "  <li>",
        `    <a href="${urlOf(post)}"><h2>${escapeHtml(post.meta.h1)}</h2></a>`,
        `    <p class="cp-date"><time datetime="${post.meta.date}">${escapeHtml(format.format(new Date(`${post.meta.date}T00:00:00Z`)))}</time></p>`,
        `    <p>${escapeHtml(post.meta.description)}</p>`,
        "  </li>",
      ].join("\n")),
      "</ul>",
      callToAction(lang, "complet"),
      "</main>",
      footer(lang),
    ].join("\n");
    const graph = [organization(), { "@type": "Blog", "@id": `${url}#blog`, url, name: t(lang, "cp_blog_title"), inLanguage: lang, blogPost: list.map((post) => ({ "@type": "BlogPosting", headline: post.meta.h1, url: urlOf(post, true), datePublished: post.meta.date })) }, breadcrumbList(trail)];
    return document(lang, head(lang, { title: t(lang, "cp_blog_title"), description: t(lang, "cp_blog_description"), url, alts, type: "blog" }), jsonLd(graph), main);
  }

  // ── What the build needs ──────────────────────────────────────

  function outputs() {
    const files = {};
    for (const page of pages) files[fileOf(page)] = renderPage(page);
    for (const lang of LANGS) if (hasBlog(lang)) files[`${lang}/${BLOG_SLUG[lang]}/index.html`] = renderBlogIndex(lang);
    return files;
  }

  /** Sitemap entries: [address, [[lang, address]…]] for every published page. */
  function sitemapEntries() {
    const entries = pages.filter((page) => !page.draft).map((page) => [urlOf(page, true), alternates(page)]);
    const blogs = LANGS.filter((lang) => articles(lang).some((post) => !post.draft));
    for (const lang of blogs) entries.push([blogUrl(lang, true), blogs.map((code) => [code, blogUrl(code, true)])]);
    return entries;
  }

  return { all, pages, find, pageHref, urlOf, fileOf, outputs, sitemapEntries, renderPage, articles, hasBlog, blogUrl, BLOG_SLUG };
}
