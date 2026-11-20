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
