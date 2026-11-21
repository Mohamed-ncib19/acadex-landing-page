// Builds the pages that are published: one pre-rendered page per language
// (/ar/, /fr/, /en/), each complete in its raw HTML.
//
//   node scripts/build.mjs           writes the files
//   node scripts/build.mjs --check   fails when a published file is out of date
//
// Sources: src/page.html (the page, with data-i18n hooks), src/i18n/<lang>.json
// (every text), site.config.json (address of the site, contacts). The output is
// committed: the host serves the folder as it is, there is no build step there.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Localization = require("../assets/localization.js");
const RATES = require("../assets/rates.js");

export const LANGS = ["ar", "fr", "en"];
const DIR = { ar: "rtl", fr: "ltr", en: "ltr" };
const OG_LOCALE = { ar: "ar_TN", fr: "fr_TN", en: "en_US" };

const readText = (file) => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
export const config = JSON.parse(readText("site.config.json"));
export const dictionaries = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(readText(`src/i18n/${lang}.json`))]));

const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text) => escapeHtml(text).replace(/"/g, "&quot;");
const stripTags = (html) => String(html).replace(/<[^>]+>/g, "");

/** The address of a language's page, absolute (`full`) or from the site root. */
export function pageUrl(lang, full = false) {
  return `${full ? config.origin : ""}/${lang}/`;
}

/**
 * A short fingerprint of a file. Every asset is addressed with it, so the host
 * can cache assets for a year and a changed file is still never served stale.
 */
const versions = new Map();
function assetVersion(file) {
  if (!versions.has(file)) {
    // Text is hashed with normalised line endings: the same on every checkout.
    const content = /\.(css|js|json|svg|txt)$/.test(file) ? readText(file) : fs.readFileSync(path.join(ROOT, file));
    versions.set(file, crypto.createHash("sha256").update(content).digest("hex").slice(0, 10));
  }
  return versions.get(file);
}
const asset = (file) => `/${file}?v=${assetVersion(file)}`;

/** The font a page's own text is set in: fetched early, the others only if needed. */
const MAIN_FONT = { ar: "assets/fonts/cairo-arabic.woff2", fr: "assets/fonts/plus-jakarta-sans-latin.woff2", en: "assets/fonts/plus-jakarta-sans-latin.woff2" };

// ── Working on the template without a DOM ───────────────────────
// The template is ours and regular: an element that carries a hook never
// contains another element of the same tag. The build refuses anything else.

/** Calls `fn(value, open, inner)` for every element carrying `attr`; `fn` returns `{ open, inner }`. */
function mapElements(html, attr, fn) {
  // The attribute may come without a value (`data-currency`); a longer name (`data-price-full`) is another hook.
  const pattern = new RegExp(`<([a-zA-Z0-9]+)\\b[^<>]*\\s${attr}(?:="([^"]*)")?(?=[\\s>/])[^<>]*>`, "g");
  let out = "";
  let last = 0;
  let match;
  while ((match = pattern.exec(html))) {
    const [open, tag, value] = match;
    const start = match.index;
    if (start < last) continue;
    const closing = `</${tag}>`;
    const isVoid = /^(img|input|br|hr|meta|link|source)$/i.test(tag);
    let inner = null;
    let end = start + open.length;
    if (!isVoid) {
      const close = html.indexOf(closing, end);
      if (close < 0) throw new Error(`no ${closing} after ${open}`);
      inner = html.slice(end, close);
      if (new RegExp(`<${tag}\\b`, "i").test(inner)) throw new Error(`nested <${tag}> inside ${open}`);
      end = close;
    }
    const result = fn(value, open, inner);
    out += html.slice(last, start) + result.open + (isVoid ? "" : result.inner);
    last = end;
    pattern.lastIndex = end;
  }
  return out + html.slice(last);
}

/** Calls `fn(value, open)` for every opening tag carrying `attr`; `fn` returns the new opening tag. */
function mapOpenTags(html, attr, fn) {
  const pattern = new RegExp(`<[a-zA-Z0-9]+\\b[^<>]*\\s${attr}="([^"]*)"[^<>]*>`, "g");
  return html.replace(pattern, (open, value) => fn(value, open));
}

/** Sets (or adds) one attribute on an opening tag. */
function setAttr(open, name, value) {
  const attr = `${name}="${escapeAttr(value)}"`;
  const existing = new RegExp(`\\s${name}="[^"]*"`);
  if (existing.test(open)) return open.replace(existing, ` ${attr}`);
  return open.replace(/\s*\/?>$/, (tail) => ` ${attr}${tail.trim()}`);
}
const dropAttr = (open, name) => open.replace(new RegExp(`\\s${name}(="[^"]*")?`), "");

// ── Prices, as the page script would write them for the default country ──

function priceTable(lang) {
  return Localization.priceTable(config.pricingCountry, lang, RATES);
}

function fill(text, vars) {
  let out = text;
  for (const name in vars) out = out.split(`{${name}}`).join(vars[name]);
  return out;
}

function priceVars(lang) {
  const table = priceTable(lang);
  const diff = Localization.formatMoney(table.complet.amount - table.plus.amount, table.complet.currency, lang, config.pricingCountry).formatted;
  return { p1: table.essentiel.formatted, p2: table.plus.formatted, p3: table.complet.formatted, diff, price: table.complet.formatted };
}

/** A text of a language with its price placeholders filled; HTML kept when the text carries some. */
function text(lang, key) {
  const value = dictionaries[lang][key];
  if (value === undefined) throw new Error(`missing dictionary key "${key}" (${lang})`);
  return fill(value, priceVars(lang));
}
const textHtml = (lang, key) => {
  const value = text(lang, key);
  return value.includes("<") ? value : escapeHtml(value);
};

// ── The body ───────────────────────────────────────────────────

/** The dictionary keys the page script reads at run time (order form, country picker, prices). */
export function runtimeKeys(template) {
  const script = readText("assets/site.js");
  const keys = new Set();
  for (const [, literal] of script.matchAll(/"([a-z0-9_]+)"/g)) {
    if (literal in dictionaries.fr) keys.add(literal);
  }
  for (const [open] of template.matchAll(/<[a-zA-Z0-9]+\b[^<>]*\sdata-price-template="[^"]*"[^<>]*>/g)) {
    const key = /\sdata-i18n="([^"]*)"/.exec(open);
    if (key) keys.add(key[1]);
  }
  return [...keys].sort();
}

export function renderBody(lang) {
  let html = readText("src/page.html");
  const table = priceTable(lang);

  // Texts.
  html = mapElements(html, "data-i18n", (key, open, inner) => {
    const keep = /\sdata-price-template=/.test(open);
    return { open: keep ? open : dropAttr(open, "data-i18n"), inner: textHtml(lang, key) };
  });
  // Attributes that carry a text.
  for (const [hook, attr] of [["data-i18n-ph", "placeholder"], ["data-i18n-aria", "aria-label"], ["data-i18n-title", "title"], ["data-i18n-alt", "alt"]]) {
    html = mapOpenTags(html, hook, (key, open) => setAttr(dropAttr(open, hook), attr, stripTags(text(lang, key))));
  }
  // WhatsApp links open on a message prefilled in the page's language.
  html = mapOpenTags(html, "data-wa-msg", (key, open) =>
    setAttr(dropAttr(open, "data-wa-msg"), "href", `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text(lang, key))}`));
  // Prices of the default country: the page script replaces them for a visitor elsewhere.
  html = mapElements(html, "data-price", (pack, open) => ({ open, inner: escapeHtml(table[pack].amountText) }));
  html = mapElements(html, "data-price-full", (pack, open) => ({ open, inner: escapeHtml(table[pack].formatted) }));
  html = mapElements(html, "data-old-price", (pack, open) => table[pack].oldAmount != null
    ? { open, inner: escapeHtml(table[pack].oldAmountText) }
    : { open: setAttr(open, "hidden", ""), inner: "" });
  html = mapElements(html, "data-old-price-full", (pack, open) => table[pack].oldAmount != null
    ? { open, inner: escapeHtml(table[pack].oldFormatted) }
    : { open: setAttr(open, "hidden", ""), inner: "" });
  html = mapElements(html, "data-currency", (_, open) => ({ open, inner: escapeHtml(table.essentiel.currencyText) }));
  // The default country, as the page script would write it: name, button label, hint.
  const countryName = Localization.countryName(config.pricingCountry, lang);
  const countryCurrency = Localization.effectiveCurrency(config.pricingCountry, RATES);
  html = mapElements(html, "data-country-name", (_, open) => ({ open: dropAttr(open, "data-country-name"), inner: escapeHtml(countryName) }));
  html = mapOpenTags(html, "data-country-chip", (key, open) => {
    const label = `${countryName} · ${countryCurrency}`;
    return setAttr(setAttr(dropAttr(open, "data-country-chip"), "aria-label", `${label} — ${stripTags(text(lang, key))}`), "title", label);
  });
  html = mapElements(html, "data-country-hint", (key, open) => ({
    open: dropAttr(open, "data-country-hint"),
    inner: escapeHtml(fill(dictionaries[lang][key], { country: countryName, currency: countryCurrency })),
  }));
  html = html.replace(/ hidden=""/g, " hidden");

  // The language links: this page's own is marked as the current one.
  html = mapOpenTags(html, "data-lang", (code, open) =>
    code === lang ? setAttr(open.replace('class="lang-btn"', 'class="lang-btn active"'), "aria-current", "page") : open);
  html = html.split("{{HOME}}").join(pageUrl(lang));
  // Images and the video are addressed with their fingerprint, like the stylesheet.
  html = html.replace(/\b(src|poster)="\/(assets\/[^"?#]+)"/g, (_, attr, file) => `${attr}="${asset(file)}"`);

  const leftover = /data-i18n-(ph|aria|title|alt)=|data-wa-msg=|{{[A-Z_]+}}/.exec(html);
  if (leftover) throw new Error(`unresolved hook in the ${lang} page: ${leftover[0]}`);
  return html;
}

// ── The head ───────────────────────────────────────────────────

function renderHead(lang) {
  const t = (key) => stripTags(text(lang, key));
  const lines = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtml(t("meta_title"))}</title>`,
    `<meta name="description" content="${escapeAttr(t("meta_description"))}">`,
    `<link rel="canonical" href="${pageUrl(lang, true)}">`,
    ...LANGS.map((code) => `<link rel="alternate" hreflang="${code}" href="${pageUrl(code, true)}">`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(config.defaultLang, true)}">`,
    `<link rel="icon" type="image/png" href="${asset("assets/logo-128.png")}">`,
    '<meta name="theme-color" content="#07090E">',
    ...renderVerificationTags(),
    ...renderSocialTags(lang),
    `<link rel="preload" as="font" type="font/woff2" href="/${MAIN_FONT[lang]}" crossorigin>`,
    // The demo poster is the largest thing in the first screen (on a phone too,
    // where its top shows under the Arabic headline): fetch it first.
    `<link rel="preload" as="image" href="${asset("assets/demo-poster.webp")}" fetchpriority="high">`,
    `<link rel="stylesheet" href="${asset("assets/site.css")}">`,
    renderAnalyticsTag(),
    ...["assets/countries.js", "assets/rates.js", "assets/localization.js", "assets/order.js", "assets/site.js"]
      .map((file) => `<script src="${asset(file)}" defer></script>`),
  ];
  return lines.join("\n");
}

/** The tags Google Search Console and Bing Webmaster Tools look for to confirm who owns the site. */
function renderVerificationTags() {
  const codes = config.verification || {};
  return [
    codes.google ? `<meta name="google-site-verification" content="${escapeAttr(codes.google)}">` : null,
    codes.bing ? `<meta name="msvalidate.01" content="${escapeAttr(codes.bing)}">` : null,
  ].filter(Boolean);
}

/** The origins each analytics provider needs in the Content-Security-Policy of vercel.json. */
export const ANALYTICS_ORIGINS = {
  plausible: { script: ["https://plausible.io"], connect: ["https://plausible.io"] },
  umami: { script: ["https://cloud.umami.is"], connect: ["https://cloud.umami.is", "https://api-gateway.umami.dev"] },
  ga4: { script: ["https://www.googletagmanager.com"], connect: ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com"] },
};

/**
 * The measurement script. It always loads (its events can be read from the
 * console); it only sends them somewhere once a provider is set in
 * site.config.json → analytics.
 */
function renderAnalyticsTag() {
  const analytics = config.analytics || {};
  const provider = analytics.provider || "";
  if (provider && !ANALYTICS_ORIGINS[provider]) throw new Error(`unknown analytics provider "${provider}" (plausible, umami or ga4)`);
  if (provider && !analytics.site && !(provider === "plausible" && analytics.script)) throw new Error(`analytics.site is required for ${provider}`);
  const data = provider
    ? [` data-provider="${escapeAttr(provider)}"`, analytics.site ? ` data-site="${escapeAttr(analytics.site)}"` : "", analytics.script ? ` data-script="${escapeAttr(analytics.script)}"` : ""].join("")
    : "";
  return `<script src="${asset("assets/analytics.js")}" defer${data}></script>`;
}

/** What a link to the page looks like when it is shared (Facebook, WhatsApp, X…). */
function renderSocialTags(lang) {
  const t = (key) => escapeAttr(stripTags(text(lang, key)));
  const image = config.origin + asset(`assets/og-${lang}.jpg`);
  return [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Acadex">',
    `<meta property="og:title" content="${t("meta_title")}">`,
    `<meta property="og:description" content="${t("meta_description")}">`,
    `<meta property="og:url" content="${pageUrl(lang, true)}">`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}">`,
    ...LANGS.filter((code) => code !== lang).map((code) => `<meta property="og:locale:alternate" content="${OG_LOCALE[code]}">`),
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${t("og_image_alt")}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${t("meta_title")}">`,
    `<meta name="twitter:description" content="${t("meta_description")}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${t("og_image_alt")}">`,
  ];
}

/** The FAQ of the page, read from the template: the questions shown and nothing else. */
function faqEntries(lang) {
  const template = readText("src/page.html");
  const numbers = [...template.matchAll(/data-i18n="faq_q(\d+)"/g)].map((match) => match[1]);
  return numbers.map((n) => ({ question: stripTags(text(lang, `faq_q${n}`)), answer: stripTags(text(lang, `faq_a${n}`)) }));
}

/**
 * Structured data: who publishes the site, the site, the software and its three
 * offers, and the FAQ. Only what the page itself says: no rating, no review.
 */
export function structuredData(lang) {
  const t = (key) => stripTags(text(lang, key));
  const table = priceTable(lang);
  const home = `${config.origin}/`;
  const page = pageUrl(lang, true);
  const packs = ["essentiel", "plus", "complet"];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${home}#organization`,
        name: "Acadex",
        url: home,
        logo: { "@type": "ImageObject", url: `${config.origin}/assets/logo-512.png`, width: 512, height: 512 },
        email: config.email,
        telephone: `+${config.whatsapp}`,
        address: { "@type": "PostalAddress", addressLocality: config.city, addressCountry: config.country },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "sales",
          telephone: `+${config.whatsapp}`,
          email: config.email,
          availableLanguage: ["ar", "fr", "en"],
          areaServed: config.country,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        url: home,
        name: "Acadex",
        inLanguage: LANGS,
        publisher: { "@id": `${home}#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${page}#webpage`,
        url: page,
        name: t("meta_title"),
        description: t("meta_description"),
        inLanguage: lang,
        isPartOf: { "@id": `${home}#website` },
        about: { "@id": `${home}#software` },
        primaryImageOfPage: { "@type": "ImageObject", url: `${config.origin}/assets/og-${lang}.jpg`, width: 1200, height: 630 },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${home}#software`,
        name: "Acadex",
        description: t("meta_description"),
        url: page,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: t("ld_category"),
        operatingSystem: "Windows 10, Windows 11",
        processorRequirements: "x64",
        inLanguage: LANGS,
        downloadUrl: `${config.origin}/download`,
        image: `${config.origin}/assets/og-${lang}.jpg`,
        publisher: { "@id": `${home}#organization` },
        offers: packs.map((pack) => ({
          "@type": "Offer",
          name: `Acadex ${pack[0].toUpperCase()}${pack.slice(1)}`,
          description: t("ld_offer"),
          price: String(table[pack].amount),
          priceCurrency: table[pack].currency,
          availability: "https://schema.org/InStock",
          url: `${page}#order-${pack}`,
          eligibleRegion: config.country,
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${page}#faq`,
        inLanguage: lang,
        isPartOf: { "@id": `${page}#webpage` },
        mainEntity: faqEntries(lang).map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}

function renderStructuredData(lang) {
  return `<script type="application/ld+json">${JSON.stringify(structuredData(lang)).replace(/</g, "\\u003c")}</script>`;
}

/** The texts the page script needs, as data: nothing here is executed. */
function renderRuntimeDictionary(lang) {
  const keys = runtimeKeys(readText("src/page.html"));
  const subset = Object.fromEntries(keys.map((key) => [key, dictionaries[lang][key]]));
  return `<script type="application/json" id="acadex-i18n">${JSON.stringify(subset).replace(/</g, "\\u003c")}</script>`;
}

export function renderPage(lang) {
  return [
    "<!DOCTYPE html>",
    // data-country: the country whose prices are written in the page (read by the page script).
    `<html lang="${lang}" dir="${DIR[lang]}" class="dark" data-country="${config.pricingCountry}">`,
    "<head>",
    renderHead(lang),
    renderStructuredData(lang),
    "</head>",
    "<body>",
    "",
    renderBody(lang).trimEnd(),
    "",
    renderRuntimeDictionary(lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

// ── Every published file ───────────────────────────────────────

/** A plain page for hosts that do not apply vercel.json: it sends the visitor to the default language. */
function renderRootStub() {
  const target = `${config.defaultLang}/`;
  return [
    "<!DOCTYPE html>",
    `<html lang="${config.defaultLang}">`,
    "<head>",
    '<meta charset="UTF-8">',
    "<title>Acadex</title>",
    '<meta name="robots" content="noindex">',
    `<link rel="canonical" href="${pageUrl(config.defaultLang, true)}">`,
    `<meta http-equiv="refresh" content="0; url=${target}">`,
    "</head>",
    "<body>",
    `<p><a href="${target}">Acadex</a></p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/**
 * The page served for an address that does not exist. One file for the whole
 * site, so it speaks the three languages, the default one first.
 */
function renderNotFound() {
  const order = [config.defaultLang, ...LANGS.filter((lang) => lang !== config.defaultLang)];
  const blocks = order.map((lang) => {
    const t = (key) => escapeHtml(stripTags(text(lang, key)));
    return [
      `    <section class="nf-block" lang="${lang}" dir="${DIR[lang]}">`,
      `      <h2>${t("nf_title")}</h2>`,
      `      <p>${t("nf_text")}</p>`,
      `      <a class="btn-primary" href="${pageUrl(lang)}">${t("nf_home")}</a>`,
      "    </section>",
    ].join("\n");
  });
  return [
    "<!DOCTYPE html>",
    `<html lang="${config.defaultLang}" dir="${DIR[config.defaultLang]}" class="dark">`,
    "<head>",
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtml(stripTags(text(config.defaultLang, "nf_title")))} — Acadex</title>`,
    '<meta name="robots" content="noindex">',
    `<link rel="icon" type="image/png" href="${asset("assets/logo-128.png")}">`,
    '<meta name="theme-color" content="#07090E">',
    `<link rel="stylesheet" href="${asset("assets/site.css")}">`,
    "</head>",
    "<body>",
    '<main class="nf">',
    `  <a class="brand" href="${pageUrl(config.defaultLang)}"><img src="${asset("assets/logo-128.png")}" alt="" class="brand-logo" width="34" height="34"><span class="brand-name">Acadex</span></a>`,
    '  <h1 class="nf-code">404</h1>',
    '  <div class="nf-blocks">',
    ...blocks,
    "  </div>",
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** Every language page, each one naming its siblings (the same hreflang set as in the pages). */
function renderSitemap() {
  const entries = LANGS.map((lang) => [
    "  <url>",
    `    <loc>${pageUrl(lang, true)}</loc>`,
    ...LANGS.map((code) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${pageUrl(code, true)}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(config.defaultLang, true)}"/>`,
    "  </url>",
  ].join("\n"));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

function renderRobots() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /download",
    "",
    `Sitemap: ${config.origin}/sitemap.xml`,
    "",
  ].join("\n");
}

export function outputs() {
  const files = {};
  for (const lang of LANGS) files[`${lang}/index.html`] = renderPage(lang);
  files["index.html"] = renderRootStub();
  files["404.html"] = renderNotFound();
  files["sitemap.xml"] = renderSitemap();
  files["robots.txt"] = renderRobots();
  return files;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [file, content] of Object.entries(outputs())) {
    const target = path.join(ROOT, file);
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : null;
    if (current === content) continue;
    if (check) { stale.push(file); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    console.log(`wrote ${file} (${content.length} chars)`);
  }
  if (check && stale.length) {
    console.error(`Out of date: ${stale.join(", ")} — run "node scripts/build.mjs".`);
    process.exit(1);
  }
  if (check) console.log("published files are up to date");
}
