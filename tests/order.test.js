const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../assets/order.js");

test("normalizes Tunisian, French and US numbers to E.164", () => {
  assert.equal(O.normalizePhone("216", "12 345 678"), "+21612345678");
  assert.equal(O.normalizePhone("33", "06 12 34 56 78"), "+33612345678");
  assert.equal(O.normalizePhone("1", "(415) 555-2671"), "+14155552671");
});

test("accepts a typed international prefix and removes the trunk zero", () => {
  assert.equal(O.normalizePhone("216", "+216 12 345 678"), "+21612345678");
  assert.equal(O.normalizePhone("216", "00216 12 345 678"), "+21612345678");
  assert.equal(O.normalizePhone("33", "0033 6 12 34 56 78"), "+33612345678");
});

test("refuses numbers that are too short, too long or missing a dial code", () => {
  assert.equal(O.normalizePhone("33", "123"), null);
  assert.equal(O.normalizePhone("33", "1234567890123456"), null);
  assert.equal(O.normalizePhone("", "612345678"), null);
});

test("builds the exact order payload and refuses incomplete input", () => {
  const payload = O.buildOrderPayload({
    pack: "complet",
    contactName: "  École Les Jasmins  ",
    phone: "+33612345678",
    country: "FR",
    currency: "EUR",
    amountMinor: 12900,
    lang: "fr",
    website: "",
  });
  assert.deepEqual(payload, {
    pack: "complet",
    billing: "once",
    school_name: "École Les Jasmins",
    contact_name: "École Les Jasmins",
    phone: "+33612345678",
    country: "FR",
    currency: "EUR",
    amount_minor: 12900,
    lang: "fr",
    website: "",
  });
  assert.equal(O.buildOrderPayload({ ...payload, pack: "gold" }), null);
  assert.equal(O.buildOrderPayload({ ...payload, amountMinor: -1 }), null);
  assert.equal(O.buildOrderPayload({ ...payload, phone: "0612345678" }), null);
});
