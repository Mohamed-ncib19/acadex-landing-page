const test = require("node:test");
const assert = require("node:assert/strict");
const countries = require("../assets/countries.js");

test("dataset covers every ISO 3166-1 alpha-2 country used by the page", () => {
  assert.ok(Object.keys(countries).length >= 240);
  for (const code of ["TN", "FR", "DE", "GB", "SA", "AE", "MA", "DZ", "US", "JP", "KW"]) {
    assert.ok(countries[code], `missing ${code}`);
  }
});

test("every entry has a currency, dial code and fallback language", () => {
  for (const [code, entry] of Object.entries(countries)) {
    assert.match(code, /^[A-Z]{2}$/);
    assert.match(entry.currency, /^[A-Z]{3}$/, `${code} currency`);
    assert.match(entry.dial, /^\d{1,4}$/, `${code} dial`);
    assert.ok(["ar", "fr", "en"].includes(entry.lang), `${code} lang`);
  }
});

test("the anchor markets map to the expected data", () => {
  assert.deepEqual(countries.TN, { currency: "TND", dial: "216", lang: "fr" });
  assert.deepEqual(countries.FR, { currency: "EUR", dial: "33", lang: "fr" });
  assert.deepEqual(countries.SA, { currency: "SAR", dial: "966", lang: "ar" });
  assert.deepEqual(countries.US, { currency: "USD", dial: "1", lang: "en" });
  assert.equal(countries.MA.lang, "fr");
  assert.equal(countries.DZ.lang, "fr");
  assert.equal(countries.CK.currency, "NZD");
  assert.equal(countries.CU.currency, "CUP");
});
