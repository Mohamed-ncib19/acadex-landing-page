const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/geo.js");

test("reads and validates the Vercel country header", () => {
  assert.equal(handler.countryFromHeader("fr"), "FR");
  assert.equal(handler.countryFromHeader(" XX "), "XX");
  assert.equal(handler.countryFromHeader("FRA"), null);
  assert.equal(handler.countryFromHeader("1A"), null);
  assert.equal(handler.countryFromHeader(""), null);
  assert.equal(handler.countryFromHeader(undefined), null);
});

test("answers JSON and never caches the visitor's country", () => {
  const headers = {};
  let body = "";
  const res = {
    statusCode: 0,
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = value; },
  };
  handler({ headers: { "x-vercel-ip-country": "TN" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(headers["Cache-Control"], "no-store");
  assert.match(headers["Content-Type"], /application\/json/);
  assert.deepEqual(JSON.parse(body), { country: "TN" });
});
