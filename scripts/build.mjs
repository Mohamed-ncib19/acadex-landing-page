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

/** A short fingerprint of a file, so a changed stylesheet or script is never served stale. */
function assetVersion(file) {
  const text = readText(file);
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 10);
}
const asset = (file) => `/${file}?v=${assetVersion(file)}`;

// ── Working on the template without a DOM ───────────────────────
// The template is ours and regular: an element that carries a hook never
// contains another element of the same tag. The build refuses anything else.

/** Calls `fn(value, open, inner)` for every element carrying `attr`; `fn` returns `{ open, inner }`. */
function mapElements(html, attr, fn) {
  const pattern = new RegExp(`<([a-zA-Z0-9]+)\\b[^<>]*\\s${attr}="([^"]*)"[^<>]*>`, "g");
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
  html = html.replace(/ hidden=""/g, " hidden");

  // The language links: this page's own is marked as the current one.
  html = mapOpenTags(html, "data-lang", (code, open) =>
    code === lang ? setAttr(open.replace('class="lang-btn"', 'class="lang-btn active"'), "aria-current", "page") : open);
  html = html.split("{{HOME}}").join(pageUrl(lang));

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
    '<link rel="icon" type="image/png" href="/assets/logo-128.png">',
    '<meta name="theme-color" content="#07090E">',
    "",
    "<!-- Google Fonts -->",
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">',
    "",
    `<link rel="stylesheet" href="${asset("assets/site.css")}">`,
    ...["assets/countries.js", "assets/rates.js", "assets/localization.js", "assets/order.js", "assets/site.js"]
      .map((file) => `<script src="${asset(file)}" defer></script>`),
  ];
  return lines.join("\n");
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
    `<html lang="${lang}" dir="${DIR[lang]}" class="dark">`,
    "<head>",
    renderHead(lang),
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

export function outputs() {
  const files = {};
  for (const lang of LANGS) files[`${lang}/index.html`] = renderPage(lang);
  files["index.html"] = renderRootStub();
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
