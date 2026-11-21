const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/order-notion.js");

// A stand-in for Notion: answers the two calls the endpoint makes, and counts them.
function fakeNotion({ saveOk = true } = {}) {
  const calls = [];
  const fetchStub = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    const isSave = String(url).endsWith("/v1/pages");
    const ok = isSave ? saveOk : true;
    const data = isSave
      ? (saveOk ? { id: "page" } : { object: "error", status: 400, code: "validation_error", message: "Secret column is not a property that exists." })
      : { properties: { Nom: { type: "title" }, Téléphone: { type: "phone_number" }, Pack: { type: "select" } } };
    return { ok, status: ok ? 200 : 400, json: async () => data };
  };
  return { calls, fetchStub };
}

function call(body, { ip = "203.0.113.1", method = "POST", headers = {} } = {}) {
  const req = { method, headers: { "x-real-ip": ip, ...headers }, body };
  const res = {
    statusCode: 0,
    headers: {},
    text: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(text) { this.text = text || ""; },
  };
  return handler(req, res).then(() => ({ status: res.statusCode, headers: res.headers, body: res.text ? JSON.parse(res.text) : null }));
}

const order = (extra = {}) => ({
  pack: "plus",
  billing: "once",
  school_name: "École Les Jasmins",
  contact_name: "École Les Jasmins",
  phone: "+21612345678",
  country: "TN",
  currency: "TND",
  amount_minor: 249000,
  lang: "fr",
  website: "",
  amount_text: "249 DT",
  ...extra,
});

async function withNotion(options, run) {
  const realFetch = global.fetch;
  const realToken = process.env.NOTION_API_KEY;
  const realError = console.error;
  const notion = fakeNotion(options);
  const logged = [];
  global.fetch = notion.fetchStub;
  process.env.NOTION_API_KEY = "test-token";
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await run(notion, logged);
  } finally {
    global.fetch = realFetch;
    console.error = realError;
    if (realToken === undefined) delete process.env.NOTION_API_KEY; else process.env.NOTION_API_KEY = realToken;
  }
}

test("a normal request is saved and answered with a reference", async () => {
  await withNotion({}, async (notion) => {
    const answer = await call(order(), { ip: "203.0.113.10" });
    assert.equal(answer.status, 201);
    assert.match(answer.body.reference, /^ACX-O-[2-9A-Z]{6}$/);
    const save = notion.calls.find((entry) => entry.url.endsWith("/v1/pages"));
    assert.ok(save, "the request must reach Notion");
    assert.ok(save.body.includes("École Les Jasmins") && save.body.includes("+21612345678"));
  });
});

test("a filled trap field is refused and nothing is saved", async () => {
  await withNotion({}, async (notion) => {
    const answer = await call(order({ website: "http://spam.example" }), { ip: "203.0.113.11" });
    assert.equal(answer.status, 400);
    assert.equal(answer.body.field, undefined, "the answer must not point at a field of the form");
    assert.equal(notion.calls.length, 0, "nothing may be sent to Notion");
  });
});

test("an oversized request is refused before anything else", async () => {
  await withNotion({}, async (notion) => {
    const padded = await call(order({ contact_name: "x".repeat(6000) }), { ip: "203.0.113.12" });
    assert.equal(padded.status, 413);
    const declared = await call(order(), { ip: "203.0.113.12", headers: { "content-length": "50000" } });
    assert.equal(declared.status, 413);
    assert.equal(notion.calls.length, 0);
  });
});

test("one visitor is capped at five saved requests a minute; another visitor is not affected", async () => {
  await withNotion({}, async () => {
    for (let i = 0; i < 5; i += 1) assert.equal((await call(order(), { ip: "203.0.113.13" })).status, 201, `request ${i + 1}`);
    const sixth = await call(order(), { ip: "203.0.113.13" });
    assert.equal(sixth.status, 429);
    assert.ok(Number(sixth.headers["retry-after"]) >= 1 && Number(sixth.headers["retry-after"]) <= 60);
    assert.equal((await call(order(), { ip: "203.0.113.14" })).status, 201);
  });
});

test("a typing mistake is not counted against the visitor", async () => {
  await withNotion({}, async () => {
    for (let i = 0; i < 8; i += 1) {
      const answer = await call(order({ phone: "12345" }), { ip: "203.0.113.15" });
      assert.equal(answer.status, 400);
      assert.equal(answer.body.field, "phone");
    }
    assert.equal((await call(order(), { ip: "203.0.113.15" })).status, 201);
  });
});

test("when Notion refuses, its answer goes to the log and not to the browser", async () => {
  await withNotion({ saveOk: false }, async (notion, logged) => {
    const answer = await call(order(), { ip: "203.0.113.16" });
    assert.equal(answer.status, 502);
    assert.deepEqual(answer.body, { ok: false, error: "Notion save failed" });
    assert.ok(logged.some((line) => line.includes("validation_error")), "the reason must be logged for the owner");
    assert.ok(!logged.join(" ").includes("+21612345678"), "the log must not carry the visitor's phone");
  });
});

test("the endpoint still refuses other methods and a missing configuration", async () => {
  await withNotion({}, async () => {
    assert.equal((await call(order(), { method: "GET", ip: "203.0.113.17" })).status, 405);
    delete process.env.NOTION_API_KEY;
    assert.equal((await call(order(), { ip: "203.0.113.17" })).status, 503);
  });
});
