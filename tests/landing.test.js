const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("loads the localization scripts before the page script", () => {
  for (const file of ["assets/countries.js", "assets/rates.js", "assets/localization.js"]) {
    assert.ok(html.includes(`src="${file}"`), `missing ${file}`);
  }
});

test("bootstraps the document language before the body renders", () => {
  assert.ok(html.includes("i18n-pending"));
  assert.ok(html.includes("navigator.languages"));
  assert.ok(html.includes("document.documentElement.dir"));
  assert.ok(html.includes("setTimeout"));
});

test("no longer defaults the language to Arabic", () => {
  assert.equal(html.includes('localStorage.getItem("acadex_lang") || "ar"'), false);
});

test("language buttons persist the visitor's choice", () => {
  assert.ok(html.includes('applyLanguage(btn.getAttribute("data-lang"), true)'));
});

test("every price location is driven by a hook", () => {
  for (const pack of ["essentiel", "plus", "complet"]) {
    assert.ok(html.includes(`data-price="${pack}"`), `missing data-price ${pack}`);
    assert.ok(html.includes(`data-price-full="${pack}"`), `missing data-price-full ${pack}`);
  }
  assert.ok(html.includes('data-old-price="plus"'));
  assert.ok(html.includes('data-old-price="complet"'));
  assert.ok(html.includes('data-old-price-full="plus"'));
  assert.ok(html.includes('data-old-price-full="complet"'));
  assert.ok(html.includes('data-price-template="all"'));
  assert.ok(html.includes('data-price-template="diff"'));
  assert.ok(html.includes('data-price-template="complet"'));
});

test("the hardcoded currency label is gone and the country dialog exists", () => {
  assert.equal(html.includes('data-i18n="curr_dt"'), false);
  assert.ok(html.includes('id="country-chip"'));
  assert.ok(html.includes('id="country-dialog"'));
  assert.ok(html.includes('id="country-search"'));
  assert.ok(html.includes('id="country-list"'));
});

test("the order form uses the auto-detected country and the order helper", () => {
  assert.ok(html.includes('src="assets/order.js"'));
  assert.equal(html.includes('id="od-country"'), false);
  assert.ok(html.includes('id="od-dial"'));
  assert.ok(html.includes("AcadexOrder.normalizePhone"));
  assert.ok(html.includes("amount_minor"));
  assert.ok(html.includes('id="pricing-loc-hint"'));
});

test("Notion is no longer called from the page", () => {
  assert.equal(html.includes("NOTION_API_KEY"), false);
  assert.equal(html.includes("api.notion.com"), false);
  assert.equal(html.includes("saveOrderToNotion"), false);
  assert.equal(html.toLowerCase().includes("notion"), false);
});

function dictKeys(lang) {
  const start = html.indexOf(`    ${lang}: {`);
  const end = lang === "ar"
    ? html.indexOf("    fr: {")
    : lang === "fr"
      ? html.indexOf("    en: {")
      : html.indexOf("\n  };", start);
  const chunk = html.slice(start, end);
  return [...chunk.matchAll(/^ {6}([A-Za-z0-9_]+):/gm)].map((m) => m[1]).sort();
}

test("all three dictionaries carry the same keys", () => {
  assert.deepEqual(dictKeys("ar"), dictKeys("fr"));
  assert.deepEqual(dictKeys("fr"), dictKeys("en"));
});

test("every data-i18n key exists in the dictionaries", () => {
  const keys = new Set(dictKeys("en"));
  const used = [...html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)].map((m) => m[1]);
  for (const key of new Set(used)) assert.ok(keys.has(key), `missing dictionary key: ${key}`);
});
