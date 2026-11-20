const test = require("node:test");
const assert = require("node:assert/strict");
const rates = require("../assets/rates.js");
const countries = require("../assets/countries.js");

test("snapshot is dated, based on USD, and includes the anchor currencies", () => {
  assert.equal(rates.base, "USD");
  assert.match(rates.updated, /^\d{4}-\d{2}-\d{2}$/);
  for (const code of ["USD", "EUR", "TND", "SAR"]) {
    assert.equal(typeof rates.units_per_usd[code], "number");
    assert.ok(rates.units_per_usd[code] > 0, code);
  }
  assert.equal(rates.units_per_usd.USD, 1);
});

test("every currency used by a country has a rate except the documented fallback", () => {
  const used = new Set(Object.values(countries).map((entry) => entry.currency));
  const missing = [...used].filter((code) => !(code in rates.units_per_usd)).sort();
  // KPW has no published rate; the page quotes the USD anchor instead.
  assert.deepEqual(missing, ["KPW"]);
});
