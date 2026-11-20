const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../assets/localization.js");
const rates = require("../assets/rates.js");

test("anchor selection follows the market map", () => {
  for (const c of ["TN", "DZ", "MA", "LY", "MR"]) assert.equal(L.anchorCurrency(c), "TND", c);
  for (const c of ["FR", "DE", "GB", "IT"]) assert.equal(L.anchorCurrency(c), "EUR", c);
  for (const c of ["SA", "AE", "QA", "KW", "BH", "OM"]) assert.equal(L.anchorCurrency(c), "SAR", c);
  for (const c of ["US", "JP", "EG", "BR"]) assert.equal(L.anchorCurrency(c), "USD", c);
});

test("Tunisia keeps the exact anchor prices and old prices", () => {
  const table = L.priceTable("TN", "fr", rates);
  assert.equal(table.essentiel.amount, 150);
  assert.equal(table.plus.amount, 249);
  assert.equal(table.complet.amount, 299);
  assert.equal(table.plus.oldAmount, 450);
  assert.equal(table.complet.oldAmount, 600);
  assert.equal(table.complet.currency, "TND");
  assert.equal(table.complet.amountMinor, 299000);
  assert.match(table.complet.formatted, /299/);
  assert.match(table.complet.formatted, /DT/);
});

test("Europe, the Gulf and international anchors are exact", () => {
  const fr = L.priceTable("FR", "fr", rates);
  assert.deepEqual([fr.essentiel.amount, fr.plus.amount, fr.complet.amount], [59, 99, 129]);
  assert.equal(fr.complet.currency, "EUR");
  assert.equal(fr.complet.amountMinor, 12900);
  assert.equal(fr.plus.oldAmount, 180);
  assert.equal(fr.complet.oldAmount, 260);

  const sa = L.priceTable("SA", "ar", rates);
  assert.deepEqual([sa.essentiel.amount, sa.plus.amount, sa.complet.amount], [249, 399, 499]);
  assert.equal(sa.complet.currency, "SAR");

  const us = L.priceTable("US", "en", rates);
  assert.deepEqual([us.essentiel.amount, us.plus.amount, us.complet.amount], [59, 99, 129]);
  assert.equal(us.complet.currency, "USD");
});

test("converted currencies round by magnitude and keep the right minor units", () => {
  const jp = L.priceTable("JP", "en", rates);
  assert.equal(jp.essentiel.currency, "JPY");
  assert.ok(Number.isInteger(jp.essentiel.amount));
  assert.equal(jp.essentiel.amountMinor, jp.essentiel.amount);
  assert.ok(jp.complet.amount >= 10000);

  const kw = L.priceTable("KW", "ar", rates);
  assert.equal(kw.essentiel.currency, "KWD");
  assert.equal(kw.essentiel.amountMinor, Math.round(kw.essentiel.amount * 1000));
  assert.ok(kw.complet.amount >= 30);
});

test("a missing local rate falls back to the anchor currency, never NaN", () => {
  const onlyUsd = { base: "USD", updated: "2026-11-20", units_per_usd: { USD: 1 } };
  const jp = L.priceTable("JP", "en", onlyUsd);
  assert.equal(jp.essentiel.currency, "USD");
  assert.equal(jp.essentiel.amount, 59);
  assert.equal(jp.complet.amount, 129);
  assert.ok(Number.isFinite(jp.complet.amount));
});

test("browser region and language resolution follow the documented order", () => {
  assert.equal(L.countryFromBrowser(["de-DE", "fr-FR"]), "DE");
  assert.equal(L.countryFromBrowser(["fr"]), null);
  assert.equal(L.resolveLanguage({ saved: "fr", languages: ["ar-TN"], country: "TN" }), "fr");
  assert.equal(L.resolveLanguage({ saved: null, languages: ["ar-TN"], country: "TN" }), "ar");
  assert.equal(L.resolveLanguage({ saved: null, languages: ["de-DE"], country: "TN" }), "fr");
  assert.equal(L.resolveLanguage({ saved: null, languages: [], country: "JP" }), "en");
});

test("money formatting uses the currency's fraction digits", () => {
  assert.match(L.formatMoney(150, "TND", "fr", "TN").formatted, /150/);
  assert.match(L.formatMoney(129, "EUR", "en", "US").formatted, /129/);
  assert.equal(L.formatMoney(1000, "JPY", "en", "JP").amountText.includes("."), false);
  assert.equal(L.formatMoney(1.5, "KWD", "en", "KW").amountMinor, 1500);
});
