# Location-Aware Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every visitor to the Acadex landing page see a language that fits them and the three pack prices in their own country's currency, and record the quoted country, currency and amount with each order.

**Architecture:** Keep `index.html` as a static, no-build page. Add three small plain-script modules loaded before the page script: `assets/countries.js` (generated country → currency/dial/language data), `assets/rates.js` (dated USD cross-rates), and `assets/localization.js` (anchor selection, conversion, rounding, formatting, language resolution). Add `assets/order.js` for phone normalization and payload building, and `api/geo.js` as a Vercel function that returns the visitor's country from `x-vercel-ip-country`. The page guesses the country from the browser region immediately, confirms it with `/api/geo`, and lets the visitor override it; the override always wins. The Cloudflare order worker gains `country`, `currency` and `amount_minor` columns and accepts international phone numbers.

**Tech Stack:** Static HTML/CSS/JavaScript, Node 18+ built-in test runner (`node --test`), Vercel Node function, Cloudflare Workers + D1 + TypeScript/Jest for the order worker.

**Spec:** `D:\Acadex\docs\superpowers\specs\2026-11-20-location-aware-landing-design.md`

## Global Constraints

- `D:\Acadex` has **no build step**. New browser code is plain `<script>` files loaded before the main inline script. It must work when `index.html` is opened from disk.
- Supported languages remain exactly `ar`, `fr`, `en`. No new languages.
- Anchor prices are exact and never rounded:
  - Tunisia / TND: Essentiel 150, Plus 249, Complet 299.
  - Eurozone / EUR: 59, 99, 129.
  - Gulf / SAR: 249, 399, 499.
  - International / USD: 59, 99, 129.
- Old-price ratios: Plus = current × 450 / 249; Complet = current × 600 / 299. Old prices are computed, never hardcoded per currency.
- Anchor selection: `TN` → TND; `DZ`, `MA`, `LY`, `MR` → TND; all European countries → EUR; `SA`, `AE`, `QA`, `KW`, `BH`, `OM` → SAR; everything else → USD.
- Conversion is cross-rate through USD using the dated `units_per_usd` table. No live FX request on page load. A missing rate falls back to the anchor currency; an unknown country falls back to `US`/USD.
- Language resolution order: saved `acadex_lang` → first supported `navigator.languages` entry → country fallback language → `en`.
- Country resolution order: saved `acadex_country` → browser region → `/api/geo` confirmation → `US`. A manual country choice is never overwritten by a late geo response.
- Persist keys: `acadex_lang`, `acadex_country`. Only a user action persists them; a detected value is not saved.
- `amount_minor` is an integer in the currency's minor units: `Math.round(amount × 10^fractionDigits(currency))`.
- Order payload sent by the page: `pack`, `billing` (`"once"`), `contact_name`, `school_name`, `phone` (E.164), `country` (ISO 3166-1 alpha-2), `currency` (ISO 4217), `amount_minor`, `lang`, `website` (honeypot).
- Worker defaults for older pages: missing `country` → `TN`, missing `currency` → `TND`, missing `amount_minor` → `0`. Invalid values are refused, not defaulted.
- The page must not write to Notion. `grep -i notion index.html` must return nothing. The exposed Notion token is removed; the owner must rotate it separately.
- The installed app stays French-only with TND plan cards. That mismatch is accepted in the spec and is not changed here.
- Node 18+ is required for `node --test` and global `fetch`.
- Two repositories are touched. Commit separately: `D:\Acadex` and `D:\School Management System`. Do not mix commits across repositories.

## Review Focus

- **Unknown country or missing rate:** a visitor from a country absent from `countries.js`, or whose currency has no rate, must still see a sensible price in the anchor currency — never `NaN`, `0`, blank, or TND by accident.
- **International phone variants:** a French `06…`, a Tunisian 8-digit number, a US 10-digit number, a typed `+33…`/`00216…`, and a too-long number must each normalize correctly or be refused; an 8-digit number from a non-TN country must never be silently stored as `+216…`.
- **Unsupported browser language:** a visitor with `de-DE`, `es-ES`, or no `navigator.languages` must fall through to the country language and then English without leaving the page untranslated or RTL.
- **Late geo response:** a visitor who picks a country before `/api/geo` answers must keep that choice; the response must not change prices or the chip afterwards.
- **Zero- and three-decimal currencies:** JPY (0 decimals), KWD/BHD/OMR (3 decimals), and TND (3 decimals but whole-dinar prices) must format and round correctly, and `amount_minor` must use the right scale.

## File Structure

### `D:\Acadex` (landing page)

| File | Responsibility |
|---|---|
| `assets/countries.js` | Generated `ACADEX_COUNTRIES`: ISO2 → `{ currency, dial, lang }` for every ISO country |
| `assets/rates.js` | Generated dated `ACADEX_RATES`: `{ base: "USD", updated: "YYYY-MM-DD", units_per_usd: { ... } }` |
| `assets/localization.js` | Pure functions: anchor selection, conversion, rounding, formatting, `priceTable`, language/country resolution |
| `assets/order.js` | Pure functions: phone normalization to E.164, order payload building |
| `api/geo.js` | Vercel function returning `{ country }` from `x-vercel-ip-country` |
| `scripts/generate-countries.mjs` | One-time/refresh script for `assets/countries.js` |
| `scripts/generate-rates.mjs` | One-time/refresh script for `assets/rates.js` |
| `tests/countries.test.js` | Dataset completeness and shape |
| `tests/rates.test.js` | Rate snapshot shape and coverage |
| `tests/localization.test.js` | Anchors, conversion, rounding, formatting, language/country resolution |
| `tests/geo.test.js` | Geo header parsing and handler response |
| `tests/order.test.js` | Phone normalization and payload shape |
| `tests/landing.test.js` | Static checks on `index.html` (hooks, scripts, no Notion) |
| `index.html` | Page markup, dictionaries, bootstrap, country UI, price rendering, order form |
| `README.md` | Operations: data refresh, geo endpoint, order fields, deploy |

### `D:\School Management System` (order worker)

| File | Responsibility |
|---|---|
| `apps/backup-worker/migrations/0003-order-localization.sql` | Add `country`, `currency`, `amount_minor` to `orders` |
| `apps/backup-worker/schema.sql` | Keep the canonical schema in sync |
| `apps/backup-worker/src/orders.ts` | Validate the new fields; country-aware phone normalization; amount formatting for Telegram |
| `apps/backup-worker/src/worker.ts` | Insert the new columns; include the amount in the Telegram notification |
| `apps/backup-worker/test/orders.spec.ts` | New validation and route tests |

## Task Map

1. Generate the country dataset.
2. Generate the dated rate snapshot.
3. Build and test the localization core.
4. Add the Vercel geo endpoint.
5. Build and test the order helpers.
6. Bootstrap language and country detection in `index.html`.
7. Add the country chip/dialog and render every price.
8. Localize the order form, send the quote, and remove Notion.
9. Add landing-page static checks and update the README.
10. Add the worker migration and schema columns.
11. Extend worker order validation and phone handling.
12. Store and notify the localized amount.
13. Verify end to end and deploy in the safe order.

---

## Task 1: Country Dataset

**Files:**
- Create: `scripts/generate-countries.mjs`
- Create: `assets/countries.js` (generated output, committed)
- Test: `tests/countries.test.js`

**Interfaces:**
- Produces: browser global `ACADEX_COUNTRIES` and CommonJS export of the same object. Shape:
  ```js
  {
    TN: { currency: "TND", dial: "216", lang: "fr" },
    FR: { currency: "EUR", dial: "33", lang: "fr" },
    SA: { currency: "SAR", dial: "966", lang: "ar" },
    US: { currency: "USD", dial: "1", lang: "en" }
  }
  ```
- `dial` is digits only, no `+`.
- `lang` is one of `"ar"`, `"fr"`, `"en"`.

- [ ] **Step 1: Write the failing dataset test**

Create `tests/countries.test.js`:

```js
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/countries.test.js`

Expected: FAIL with `Cannot find module '../assets/countries.js'`.

- [ ] **Step 3: Write the generator**

Create `scripts/generate-countries.mjs`:

- Fetch `https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json` with global `fetch`.
- For each country:
  - `currency = Object.keys(country.currencies)[0]`; skip entries with no currency.
  - `dial`: `country.idd.root` without `+`, plus `country.idd.suffixes[0]` **only when `suffixes.length === 1`**; otherwise just the root. Example: FR `+3` + `3` → `33`; TN `+2` + `16` → `216`; US `+1` + many suffixes → `1`.
  - `lang`: `fr` when the code is in `MAGHREB = ["TN","DZ","MA","MR"]`; otherwise `ar` when `country.languages` has `ara`; otherwise `fr` when it has `fra`; otherwise `en`.
  - Skip entries with no `cca2`, no `currency`, or no `dial`.
- Sort keys alphabetically.
- Write `assets/countries.js` with this exact wrapper so both browser and Node can read it:
  ```js
  (function (root, data) {
    if (typeof module === "object" && module.exports) module.exports = data;
    else root.ACADEX_COUNTRIES = data;
  })(typeof globalThis !== "undefined" ? globalThis : this, {
    // sorted entries, one per line: TN: { currency: "TND", dial: "216", lang: "fr" },
  });
  ```
- Print `wrote assets/countries.js with N countries`.

- [ ] **Step 4: Run the generator**

Run: `node scripts/generate-countries.mjs`

Expected: `wrote assets/countries.js with 240+ countries`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/countries.test.js`

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-countries.mjs assets/countries.js tests/countries.test.js
git commit -m "feat: add generated country currency and language data"
```

---

## Task 2: Dated Rate Snapshot

**Files:**
- Create: `scripts/generate-rates.mjs`
- Create: `assets/rates.js` (generated output, committed)
- Test: `tests/rates.test.js`

**Interfaces:**
- Produces: browser global `ACADEX_RATES` and CommonJS export:
  ```js
  {
    base: "USD",
    updated: "2026-11-20",
    units_per_usd: { USD: 1, EUR: 0.910749, TND: 3.053816, SAR: 3.75, ... }
  }
  ```
- `units_per_usd[c]` means "one US dollar equals this many units of `c`".

- [ ] **Step 1: Write the failing rate test**

Create `tests/rates.test.js`:

```js
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

test("every currency used by a country either has a rate or is reported as a fallback", () => {
  const used = new Set(Object.values(countries).map((entry) => entry.currency));
  const missing = [...used].filter((code) => !(code in rates.units_per_usd)).sort();
  assert.deepEqual(missing, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/rates.test.js`

Expected: FAIL with `Cannot find module '../assets/rates.js'`.

- [ ] **Step 3: Write the generator**

Create `scripts/generate-rates.mjs`:

- Fetch `https://open.er-api.com/v6/latest/USD`.
- Require `result === "success"` and a `rates` object; otherwise exit with a clear error.
- Keep only entries whose key matches `/^[A-Z]{3}$/` and whose value is a finite positive number.
- `updated` is the UTC date from `time_last_update_unix` (or today if absent), formatted `YYYY-MM-DD`.
- Write `assets/rates.js` with the same UMD wrapper as `countries.js`:
  ```js
  (function (root, data) {
    if (typeof module === "object" && module.exports) module.exports = data;
    else root.ACADEX_RATES = data;
  })(typeof globalThis !== "undefined" ? globalThis : this, {
    base: "USD",
    updated: "2026-11-20",
    units_per_usd: { /* sorted entries */ }
  });
  ```
- Print `wrote assets/rates.js with N currencies (updated YYYY-MM-DD)`.

- [ ] **Step 4: Run the generator**

Run: `node scripts/generate-rates.mjs`

Expected: `wrote assets/rates.js with 150+ currencies`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/rates.test.js`

Expected: PASS (2 tests). If a currency used by `countries.js` is missing from the provider, add a manual override in the generator with a dated comment and rerun; do not weaken the test.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-rates.mjs assets/rates.js tests/rates.test.js
git commit -m "feat: add dated USD cross-rate snapshot"
```

---

## Task 3: Localization Core

**Files:**
- Create: `assets/localization.js`
- Test: `tests/localization.test.js`

**Interfaces:**
- CommonJS: `require("../assets/localization.js")`.
- Browser: `window.AcadexLocalization`.
- Depends on `./countries.js` and `./rates.js` (both already export CommonJS and browser globals).
- Produces:
  ```js
  {
    SUPPORTED_LANGUAGES,       // ["ar", "fr", "en"]
    ANCHORS,                   // { TND: {essentiel:150,...}, EUR: {...}, SAR: {...}, USD: {...} }
    anchorCurrency(country),   // "TND" | "EUR" | "SAR" | "USD"
    effectiveCurrency(country, rates = RATES), // local currency if a rate exists, else anchor
    convertAmount(amount, from, to, rates),    // number | null
    fractionDigits(currency),  // 0 | 2 | 3
    roundAmount(value, currency), // number
    formatMoney(amount, currency, lang, country), // { amount, currency, amountText, currencyText, formatted, amountMinor }
    priceTable(country, lang, rates = RATES),     // { essentiel, plus, complet }
    countryFromBrowser(languages), // ISO2 | null
    resolveLanguage({ saved, languages, country }), // "ar" | "fr" | "en"
    countryName(code, lang),   // localized name, or the code
    isSupportedCountry(code)   // boolean
  }
  ```

**Algorithm decisions (pin these; do not improvise):**

- `MAGHREB = ["TN","DZ","MA","LY","MR"]` → TND anchor.
- `EUROPE = ["AD","AL","AM","AT","AZ","BA","BE","BG","BY","CH","CY","CZ","DE","DK","EE","ES","FI","FR","GB","GE","GR","HR","HU","IE","IS","IT","LI","LT","LU","LV","MC","MD","ME","MK","MT","NL","NO","PL","PT","RO","RS","RU","SE","SI","SK","SM","TR","UA","VA","XK"]` → EUR anchor.
- `GCC = ["SA","AE","QA","KW","BH","OM"]` → SAR anchor.
- Everything else → USD anchor.
- `convertAmount`: `amount / units_per_usd[from] * units_per_usd[to]`; return `null` if either rate is missing or `<= 0`.
- `fractionDigits`: `new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits`; on error return `2`.
- `roundAmount`:
  - `digits === 0`: round to the magnitude step, integers only.
  - `digits === 3` and `value < 10`: round to the nearest `0.5`.
  - otherwise: `value < 10` → nearest `1`; else magnitude step.
  - Magnitude step: `>= 1e6 → 1e5`; `>= 1e5 → 1e4`; `>= 1e4 → 1e3`; `>= 1e3 → 100`; `>= 100 → 10`; `>= 10 → 5`; else `1`.
- `formatMoney`:
  - Locale: `${lang}-${country}` when `Intl.NumberFormat.supportedLocalesOf([locale]).length` is non-zero, else `lang`, else `"en"`.
  - `minimumFractionDigits: 0`, `maximumFractionDigits: fractionDigits(currency)`.
  - `amountText` uses the number formatter; `formatted` uses `style: "currency"`; `currencyText` comes from `formatToParts(...).find(part => part.type === "currency").value`.
  - `amountMinor = Math.round(amount * 10 ** fractionDigits(currency))`.
- `priceTable`:
  - For each pack, use the anchor amount. If the country's currency is the anchor, keep it exact.
  - Otherwise convert and round. If conversion returns `null`, keep the anchor amount and anchor currency (this is the missing-rate fallback).
  - Old prices: `roundAmount(amount * OLD_RATIO[pack], currency)` with `OLD_RATIO = { plus: 450 / 249, complet: 600 / 299 }`. Essentiel has no old price.
  - TND Plus/Complet old prices must come out exactly `450` and `600`.

- [ ] **Step 1: Write the failing core test**

Create `tests/localization.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/localization.test.js`

Expected: FAIL with `Cannot find module '../assets/localization.js'`.

- [ ] **Step 3: Implement `assets/localization.js`**

Use the UMD wrapper shown in the Interfaces block. Write the constants and the functions exactly as pinned above. Keep the module free of DOM access and network calls so it runs in Node and the browser.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/localization.test.js`

Expected: PASS (7 tests). If an `Intl` symbol differs by Node/ICU version, assert on the numeric part and currency code, not the exact symbol string.

- [ ] **Step 5: Commit**

```bash
git add assets/localization.js tests/localization.test.js
git commit -m "feat: add price conversion and language resolution core"
```

---

## Task 4: Vercel Geo Endpoint

**Files:**
- Create: `api/geo.js`
- Test: `tests/geo.test.js`

**Interfaces:**
- `module.exports = handler(req, res)` for Vercel's Node runtime.
- `module.exports.countryFromHeader(value)` is exported for tests.
- Response: `200`, `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`, body `{ "country": "FR" }` or `{ "country": null }`.
- Valid country: exactly two ASCII letters after trim and uppercase. `FRA`, `1A`, empty, and missing headers return `null`.

- [ ] **Step 1: Write the failing test**

Create `tests/geo.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/geo.test.js`

Expected: FAIL with `Cannot find module '../api/geo.js'`.

- [ ] **Step 3: Implement `api/geo.js`**

Use CommonJS (`module.exports`) so Vercel does not depend on a `package.json` type. Read `req.headers["x-vercel-ip-country"]`; do not read the IP itself. Set the headers and status shown above.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/geo.test.js`

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/geo.js tests/geo.test.js
git commit -m "feat: add first-party Vercel country endpoint"
```

---

## Task 5: Order Helpers

**Files:**
- Create: `assets/order.js`
- Test: `tests/order.test.js`

**Interfaces:**
- CommonJS: `require("../assets/order.js")`; browser: `window.AcadexOrder`.
- Produces:
  ```js
  {
    normalizePhone(dial, national), // "+21612345678" | null
    buildOrderPayload({ pack, contactName, phone, country, currency, amountMinor, lang, website })
      // object | null
  }
  ```
- `normalizePhone` rules:
  1. Strip every non-digit from `national`.
  2. If it starts with `00`, drop those two digits.
  3. If the remaining digits start with the selected `dial` **and** there are at least four digits after it, drop the dial (the visitor typed the full international number).
  4. If the remaining digits start with `0`, drop that one digit.
  5. Reject when the national part is shorter than 4 digits, the total (`dial.length + national.length`) is below 8 or above 15, or `dial` is empty.
  6. Return `+` + dial + national.
- `buildOrderPayload` returns `null` when `pack` is not `essentiel`/`plus`/`complet`, `contactName.trim().length < 2`, `phone` does not start with `+`, `country` is not two uppercase letters, `currency` is not three uppercase letters, or `amountMinor` is not a non-negative integer. Otherwise:
  ```js
  {
    pack,
    billing: "once",
    school_name: contactName.trim(),
    contact_name: contactName.trim(),
    phone,
    country,
    currency,
    amount_minor: amountMinor,
    lang,
    website: website || ""
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/order.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/order.test.js`

Expected: FAIL with `Cannot find module '../assets/order.js'`.

- [ ] **Step 3: Implement `assets/order.js`**

Use the same UMD wrapper as `localization.js`, but with no dependencies.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/order.test.js`

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/order.js tests/order.test.js
git commit -m "feat: add phone normalization and order payload helpers"
```

---

## Task 6: Bootstrap Language and Country Detection

**Files:**
- Modify: `index.html` (head, CSS, script tags, language initialization)
- Test: `tests/landing.test.js`

**Interfaces:**
- Consumes: `window.AcadexLocalization` from Task 3.
- Produces page globals used by Task 7:
  - `currentCountry` (ISO2, initialized before translation)
  - `countryChosenByVisitor` (boolean, set by the country picker in Task 7)
  - `initLocalization()` (called once at the old `applyLanguage(currentLang)` site)
  - `confirmCountryFromGeo()` (async, updates the country only when no manual choice exists)

- [ ] **Step 1: Write the failing static test**

Create `tests/landing.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/landing.test.js`

Expected: FAIL on the first missing script or the old Arabic default.

- [ ] **Step 3: Add the head bootstrap and the pending class**

In `<head>`, after the viewport meta, add an inline script that:

- Reads `localStorage.acadex_lang` in a `try/catch`.
- If it is not `ar`/`fr`/`en`, walks `navigator.languages` (falling back to `[navigator.language || ""]`) and takes the first two-letter code that is supported.
- Falls back to `en`.
- Sets `document.documentElement.lang` and `.dir`.
- Adds `i18n-pending` to `<html>` and removes it after 1500 ms as a safety net.

Add this CSS near the top of the existing `<style>`:

```css
html.i18n-pending body { visibility: hidden; }
```

Do not put `i18n-pending` in the static `<html>` tag: a no-JS visitor must still see the page.

- [ ] **Step 4: Load the new scripts before the inline page script**

Immediately before the existing `<script>` that starts with `document.documentElement.classList.remove("no-js")` (line 3215), add:

```html
<script src="assets/countries.js"></script>
<script src="assets/rates.js"></script>
<script src="assets/localization.js"></script>
```

`assets/order.js` is added in Task 8 when the order form uses it.

- [ ] **Step 5: Replace the language state and initialization**

In the inline script:

- Replace `let currentLang = localStorage.getItem("acadex_lang") || "ar";` with:
  ```js
  const SUPPORTED_LANGS = ["ar", "fr", "en"];
  let currentLang = "ar";
  let currentCountry = "US";
  let countryChosenByVisitor = false;
  ```
- Change `applyLanguage(lang)` to `applyLanguage(lang, persist = false)`. Keep the existing DOM work, but:
  - Ignore an unsupported `lang`.
  - Write `localStorage.setItem("acadex_lang", lang)` only when `persist` is true, inside `try/catch`.
  - At the end, `document.documentElement.classList.remove("i18n-pending")`, then dispatch `acadex:lang` as today.
- Change the language button handler to `applyLanguage(btn.getAttribute("data-lang"), true)`.
- Replace `applyLanguage(currentLang);` with `initLocalization();`.

- [ ] **Step 6: Add `initLocalization` and the geo confirmation**

Add these function declarations near `applyLanguage` (they are hoisted, so the call site can stay where it is):

```js
function savedCountry() {
  try {
    const code = localStorage.getItem("acadex_country");
    return code && AcadexLocalization.isSupportedCountry(code) ? code : null;
  } catch { return null; }
}

function savedLanguage() {
  try {
    const code = localStorage.getItem("acadex_lang");
    return SUPPORTED_LANGS.includes(code) ? code : null;
  } catch { return null; }
}

function initLocalization() {
  const saved = savedCountry();
  const languages = navigator.languages || [navigator.language || ""];
  currentCountry = saved
    || AcadexLocalization.countryFromBrowser(languages)
    || "US";
  countryChosenByVisitor = Boolean(saved);
  applyLanguage(AcadexLocalization.resolveLanguage({
    saved: savedLanguage(),
    languages,
    country: currentCountry,
  }));
  if (!saved) confirmCountryFromGeo();
}

async function confirmCountryFromGeo() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch("/api/geo", { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (countryChosenByVisitor) return;
    if (!data || !AcadexLocalization.isSupportedCountry(data.country)) return;
    currentCountry = data.country;
    if (!savedLanguage()) {
      applyLanguage(AcadexLocalization.resolveLanguage({
        saved: null,
        languages: navigator.languages || [navigator.language || ""],
        country: currentCountry,
      }));
    }
    document.dispatchEvent(new CustomEvent("acadex:country"));
  } catch {
    /* Offline, file://, or no geo endpoint: the browser guess stands. */
  } finally {
    clearTimeout(timer);
  }
}
```

`countryChosenByVisitor` is still only written by `initLocalization` in this task; Task 7 sets it when the visitor picks a country.

- [ ] **Step 7: Run the static test and the existing suites**

Run: `node --test tests/landing.test.js tests/localization.test.js tests/order.test.js`

Expected: PASS. The page still shows the TND prices from the markup; this task only changes language and country state.

- [ ] **Step 8: Manual check**

Open `index.html` from disk in a browser with a French browser profile. Expected: `<html lang="fr" dir="ltr">`, French page, no Arabic flash. With an Arabic profile: `lang="ar" dir="rtl"`. With `de-DE`: English (country fallback for DE is English), no blank page after 1.5 s.

- [ ] **Step 9: Commit**

```bash
git add index.html tests/landing.test.js
git commit -m "feat: detect visitor language and country on load"
```

---

## Task 7: Country Picker and Live Price Rendering

**Files:**
- Modify: `index.html` (header, pricing cards, comparison tabs/table, FAQ, mobile CTA, order dialog pack buttons, dictionaries, page script)
- Test: `tests/landing.test.js`

**Interfaces:**
- Consumes: `window.AcadexLocalization`, `window.ACADEX_COUNTRIES`, `window.ACADEX_RATES`, `currentCountry`, `currentLang`, `countryChosenByVisitor`.
- Produces page functions used by Task 8:
  - `priceFor(pack)` → a price object from `AcadexLocalization.priceTable`
  - `renderPrices()` → updates every price element and the country chip
  - `setCountry(code, persist = false)` → changes country, persists if asked, re-renders
  - `renderCountryChip()` and `renderCountryList(query)`

- [ ] **Step 1: Extend the static test with the new hooks**

Append to `tests/landing.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/landing.test.js`

Expected: FAIL on the missing price hooks.

- [ ] **Step 3: Add the country chip to the header**

After the language switcher (`<div class="lang-switcher">…</div>`), add:

```html
<button type="button" class="country-chip" id="country-chip" aria-haspopup="dialog" aria-label="Change country and currency">
  <span id="country-chip-name">Tunisia</span>
  <span id="country-chip-code" hidden>TN</span>
  <span class="cc-sep">·</span>
  <span class="cc-cur" id="country-chip-currency">TND</span>
</button>
```

Style `.country-chip` next to `.lang-switcher`: same pill height, `display: inline-flex`, `gap: 6px`, border `1px solid var(--border)`, radius `999px`, background `var(--bg-glass)`, font size `12px`, weight `700`, cursor pointer. `.cc-cur` uses `var(--primary-light)`. Under `@media (max-width: 720px)`, hide `#country-chip-name` and show `#country-chip-code` (`display: inline`).

- [ ] **Step 4: Add the country dialog markup**

Place it next to the order dialog (before `<dialog class="order-dialog" …>`):

```html
<dialog class="country-dialog" id="country-dialog" aria-labelledby="country-dialog-title">
  <div class="cd-head">
    <h2 id="country-dialog-title" data-i18n="country_title">Country and currency</h2>
    <button type="button" class="od-close" data-country-close aria-label="Close">…same X svg as the order dialog…</button>
  </div>
  <input class="cd-search" id="country-search" type="search" autocomplete="off"
         data-i18n-ph="country_search_ph" placeholder="Search for a country">
  <ul class="cd-list" id="country-list" role="listbox"></ul>
  <p class="cd-empty" id="country-empty" data-i18n="country_empty" hidden>No country found.</p>
</dialog>
```

Style `.country-dialog` like `.order-dialog` but `width: min(440px, 92vw)`, `max-height: 80vh`, `padding: 0`, `overflow: hidden`. `.cd-head` matches `.od-head`. `.cd-search` is a full-width input with the existing input colors. `.cd-list` scrolls (`overflow-y: auto; max-height: 55vh`). `.cd-item` is a full-width flex row between the country name and the currency code, with a hover background and an `aria-selected="true"` accent border.

- [ ] **Step 5: Add price hooks to every location**

- Cards:
  - `<span class="p-amount" data-price="essentiel">150</span>` and `<span class="p-currency" data-currency>د.ت</span>`.
  - Plus: `<del class="p-old-amount" data-old-price="plus">450</del>`, `<span class="p-amount" data-price="plus">249</span>`, `data-currency`.
  - Complet: `data-old-price="complet"`, `data-price="complet"`, `data-currency`.
- `p3_value`: add `data-price-template="diff"`.
- Comparison tabs: wrap each number in `<span data-price-full="essentiel">150</span>`, etc.; keep the ⭐/👑 outside the hook.
- Table headers: `<span data-price-full="essentiel">150</span>`, `<del class="cmp-old" data-old-price-full="plus">450</del>`, etc.
- FAQ answer: add `data-price-template="all"` to the `faq_a3` paragraph.
- Mobile CTA: add `data-price-template="complet"` to the `m_order` span.
- Order pack buttons: `<span class="pk-price"><span data-price="essentiel">150</span> <span data-currency>DT</span></span>`, etc.
- Remove every `data-i18n="curr_dt"` attribute and the `curr_dt` key from all three dictionaries.

- [ ] **Step 6: Change the dictionaries**

In `ar`, `fr` and `en`, make these exact changes:

| Key | Arabic | French | English |
|---|---|---|---|
| `faq_a3` | `ترخيص دائم دفعة واحدة ({p1} / {p2} / {p3})، مع خيار الدفع الفصلي أو السنوي لمن يرغب.` | `Non, c'est un achat unique définitif ({p1} / {p2} / {p3}). Paiement trimestriel ou annuel sur demande.` | `No. It is a permanent one-time purchase ({p1} / {p2} / {p3}). Term or annual installments available.` |
| `p3_value` | `فقط {diff} إضافية عن Plus لتفتح التقارير، التدقيق وتصدير Excel.` | `Seulement {diff} de plus que Plus pour ouvrir les rapports, l'audit et l'export Excel.` | `Only {diff} more than Plus to unlock reports, audit and Excel export.` |
| `m_order` | `اطلب Complet · {price}` | `Commander Complet · {price}` | `Order Complet · {price}` |
| `order_msg` | `طلب باقة Acadex\nالباقة: {pack} ({price}) — دفعة واحدة، ترخيص دائم\nالاسم: {name}\nالهاتف: {phone}` | `Commande Acadex\nPack : {pack} ({price}) — paiement unique, licence à vie\nNom : {name}\nTéléphone : {phone}` | `Acadex order\nPack: {pack} ({price}) — one-time payment, lifetime licence\nName: {name}\nPhone: {phone}` |
| `od_err_phone` | `رقم الهاتف غير صحيح للدولة المختارة.` | `Ce numéro de téléphone n'est pas valide pour le pays sélectionné.` | `This phone number is not valid for the selected country.` |

Add these keys to all three dictionaries:

| Key | Arabic | French | English |
|---|---|---|---|
| `country_title` | `الدولة والعملة` | `Pays et devise` | `Country and currency` |
| `country_search_ph` | `ابحث عن دولة` | `Rechercher un pays` | `Search for a country` |
| `country_empty` | `لا توجد دولة` | `Aucun pays trouvé` | `No country found` |
| `country_chip_aria` | `تغيير الدولة والعملة` | `Changer de pays et de devise` | `Change country and currency` |

- [ ] **Step 7: Implement `priceFor`, `renderPrices` and the chip**

Add near the language code, before the order section:

```js
function priceFor(pack) {
  return AcadexLocalization.priceTable(currentCountry, currentLang, window.ACADEX_RATES)[pack];
}

function renderPrices() {
  const table = AcadexLocalization.priceTable(currentCountry, currentLang, window.ACADEX_RATES);
  document.querySelectorAll("[data-price]").forEach((el) => {
    const price = table[el.getAttribute("data-price")];
    if (price) el.textContent = price.amountText;
  });
  document.querySelectorAll("[data-price-full]").forEach((el) => {
    const price = table[el.getAttribute("data-price-full")];
    if (price) el.textContent = price.formatted;
  });
  document.querySelectorAll("[data-old-price]").forEach((el) => {
    const price = table[el.getAttribute("data-old-price")];
    el.hidden = !(price && price.oldAmount != null);
    if (!el.hidden) el.textContent = price.oldAmountText;
  });
  document.querySelectorAll("[data-old-price-full]").forEach((el) => {
    const price = table[el.getAttribute("data-old-price-full")];
    el.hidden = !(price && price.oldAmount != null);
    if (!el.hidden) el.textContent = price.oldFormatted;
  });
  document.querySelectorAll("[data-currency]").forEach((el) => {
    el.textContent = table.essentiel.currencyText;
  });
  const diff = table.complet.amount - table.plus.amount;
  const diffText = AcadexLocalization.formatMoney(diff, table.complet.currency, currentLang, currentCountry).formatted;
  document.querySelectorAll("[data-price-template]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const kind = el.getAttribute("data-price-template");
    if (kind === "all") el.textContent = tr(key, { p1: table.essentiel.formatted, p2: table.plus.formatted, p3: table.complet.formatted });
    else if (kind === "diff") el.textContent = tr(key, { diff: diffText });
    else if (kind === "complet") el.textContent = tr(key, { price: table.complet.formatted });
  });
  renderCountryChip();
  renderOrderHead();
}

function renderCountryChip() {
  const chip = document.getElementById("country-chip");
  if (!chip) return;
  const name = AcadexLocalization.countryName(currentCountry, currentLang);
  const currency = AcadexLocalization.effectiveCurrency(currentCountry, window.ACADEX_RATES);
  document.getElementById("country-chip-name").textContent = name;
  document.getElementById("country-chip-code").textContent = currentCountry;
  document.getElementById("country-chip-currency").textContent = currency;
  chip.setAttribute("aria-label", tr("country_chip_aria"));
  chip.title = `${name} · ${currency}`;
}

document.addEventListener("acadex:lang", renderPrices);
```

- [ ] **Step 8: Implement the country dialog behavior**

```js
function countryOptions() {
  let display = null;
  try { display = new Intl.DisplayNames([currentLang], { type: "region" }); } catch {}
  return Object.keys(window.ACADEX_COUNTRIES)
    .map((code) => ({
      code,
      name: (display && display.of(code)) || code,
      currency: window.ACADEX_COUNTRIES[code].currency,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, currentLang));
}

function renderCountryList(query = "") {
  const q = query.trim().toLowerCase();
  const items = countryOptions().filter((o) =>
    !q || o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q) || o.currency.toLowerCase().includes(q));
  const list = document.getElementById("country-list");
  list.replaceChildren(...items.map((o) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cd-item";
    btn.dataset.country = o.code;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", o.code === currentCountry ? "true" : "false");
    const name = document.createElement("span");
    name.textContent = o.name;
    const cur = document.createElement("span");
    cur.className = "cd-item-cur";
    cur.textContent = o.currency;
    btn.append(name, cur);
    li.append(btn);
    return li;
  }));
  document.getElementById("country-empty").hidden = items.length > 0;
}

function setCountry(code, persist = false) {
  if (!AcadexLocalization.isSupportedCountry(code)) return;
  currentCountry = code;
  countryChosenByVisitor = true;
  if (persist) {
    try { localStorage.setItem("acadex_country", code); } catch {}
  }
  renderPrices();
  document.dispatchEvent(new CustomEvent("acadex:country"));
}

const countryDialog = document.getElementById("country-dialog");
const countrySearch = document.getElementById("country-search");
document.getElementById("country-chip").addEventListener("click", () => {
  countrySearch.value = "";
  renderCountryList("");
  if (typeof countryDialog.showModal === "function") countryDialog.showModal();
  else countryDialog.setAttribute("open", "");
  countrySearch.focus();
});
countrySearch.addEventListener("input", () => renderCountryList(countrySearch.value));
document.getElementById("country-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-country]");
  if (!btn) return;
  setCountry(btn.dataset.country, true);
  if (typeof countryDialog.close === "function") countryDialog.close();
  else countryDialog.removeAttribute("open");
});
countryDialog.querySelectorAll("[data-country-close]").forEach((btn) => btn.addEventListener("click", () => countryDialog.close()));
countryDialog.addEventListener("click", (e) => { if (e.target === countryDialog) countryDialog.close(); });
```

Add `renderPrices();` at the end of `initLocalization`, after `applyLanguage(...)`. In `confirmCountryFromGeo`, after updating `currentCountry`, call `renderPrices()` before dispatching `acadex:country`.

- [ ] **Step 9: Update the order head and summary to use the price table**

- Change `PACKS` to labels only:
  ```js
  const PACKS = {
    essentiel: { label: "Essentiel" },
    plus: { label: "Plus" },
    complet: { label: "Complet" },
  };
  ```
- In `renderOrderHead`, replace `pack.price` with `priceFor(key).formatted` and `pack.oldPrice` with `priceFor(key).oldFormatted`; use `pack.label` for the title.
- In `orderSummary`, replace `String(pack.price)` with `priceFor(order.pack).formatted`.
- `renderOrderOutcome` continues to use `pack.label`; no price change.

- [ ] **Step 10: Run the static test and the pure suites**

Run: `node --test tests/landing.test.js tests/localization.test.js`

Expected: PASS. The order worker is unchanged; do not run it yet.

- [ ] **Step 11: Manual price matrix check**

Serve the folder (`npx serve D:\Acadex`) and check the chip/prices for: TN (TND 150/249/299), FR (EUR 59/99/129), GB (GBP converted), SA (SAR 249/399/499), AE (AED converted), DZ (DZD converted from TND), MA (MAD converted from TND), US (USD 59/99/129), JP (JPY integers), KW (KWD 3 decimals). Also check 360 px and 390 px widths in Arabic, French and English: no horizontal overflow, chip readable, dialog scrolls.

- [ ] **Step 12: Commit**

```bash
git add index.html tests/landing.test.js
git commit -m "feat: render every price in the visitor's currency"
```

---

## Task 8: Localized Order Form and Notion Removal

**Files:**
- Modify: `index.html` (order dialog, order script, dictionaries, script tags)
- Test: `tests/landing.test.js`

**Interfaces:**
- Consumes: `priceFor`, `currentCountry`, `setCountry`, `countryOptions`, `window.AcadexOrder`.
- Produces: an order payload with `country`, `currency`, `amount_minor`; a frozen `order.quote` used by the confirmation summary.

- [ ] **Step 1: Extend the static test**

Append to `tests/landing.test.js`:

```js
test("the order form has a country selector and uses the order helper", () => {
  assert.ok(html.includes('src="assets/order.js"'));
  assert.ok(html.includes('id="od-country"'));
  assert.ok(html.includes('id="od-dial"'));
  assert.ok(html.includes("AcadexOrder.normalizePhone"));
  assert.ok(html.includes("amount_minor"));
});

test("Notion is no longer called from the page", () => {
  assert.equal(html.includes("NOTION_API_KEY"), false);
  assert.equal(html.includes("api.notion.com"), false);
  assert.equal(html.includes("saveOrderToNotion"), false);
  assert.equal(html.toLowerCase().includes("notion"), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/landing.test.js`

Expected: FAIL on the missing order helper or the Notion strings.

- [ ] **Step 3: Add the order.js script**

Immediately after `assets/localization.js`, add:

```html
<script src="assets/order.js"></script>
```

- [ ] **Step 4: Add the country selector and dial prefix to the order dialog**

Before the phone field, add:

```html
<div class="od-field">
  <label class="od-label" for="od-country" data-i18n="od_country">Country</label>
  <select class="od-input od-ltr" id="od-country" name="country"></select>
</div>
```

Replace the phone input block with:

```html
<div class="od-field">
  <label class="od-label" for="od-phone" data-i18n="od_phone">Phone</label>
  <div class="od-phone-row">
    <span class="od-dial" id="od-dial">+216</span>
    <input class="od-input od-ltr" id="od-phone" name="phone" type="tel"
           inputmode="tel" autocomplete="tel" maxlength="18"
           data-i18n-ph="od_phone_ph" placeholder="Your phone number" required>
  </div>
</div>
```

Style `.od-phone-row` as a flex row with `gap: 8px`; `.od-dial` is a non-shrinking prefix with the same border/background as `.od-input`, `display: inline-flex`, `align-items: center`, `padding: 0 10px`, `font-weight: 700`.

- [ ] **Step 5: Add the new dictionary keys**

Add to all three dictionaries:

| Key | Arabic | French | English |
|---|---|---|---|
| `od_country` | `الدولة` | `Pays` | `Country` |
| `od_phone_ph` | `أدخل رقم هاتفك` | `Votre numéro de téléphone` | `Your phone number` |
| `od_err_country` | `تعذر تحديد الدولة أو العملة. اختر الدولة مرة أخرى.` | `Impossible de déterminer le pays ou la devise. Choisissez à nouveau le pays.` | `Could not determine the country or currency. Please choose the country again.` |

- [ ] **Step 6: Populate the selector and keep it in sync**

Add near the order code:

```js
function updateOrderDial() {
  const dial = (window.ACADEX_COUNTRIES[currentCountry] || {}).dial || "";
  const el = document.getElementById("od-dial");
  if (el) el.textContent = dial ? `+${dial}` : "";
}

function populateOrderCountries() {
  const select = document.getElementById("od-country");
  if (!select) return;
  select.replaceChildren(...countryOptions().map((o) => {
    const opt = document.createElement("option");
    opt.value = o.code;
    opt.textContent = `+${window.ACADEX_COUNTRIES[o.code].dial} · ${o.name}`;
    return opt;
  }));
  select.value = currentCountry;
  updateOrderDial();
}

document.getElementById("od-country").addEventListener("change", (e) => {
  setCountry(e.target.value, true);
});
document.addEventListener("acadex:country", () => {
  const select = document.getElementById("od-country");
  if (select) select.value = currentCountry;
  updateOrderDial();
  if (phoneInput && phoneInput.value) phoneInput.value = formatPhoneNumber(phoneInput.value, currentCountry);
});
document.addEventListener("acadex:lang", populateOrderCountries);
```

Call `populateOrderCountries()` once at the end of `initLocalization`, after `renderPrices()`.

- [ ] **Step 7: Make the phone input country-aware**

Replace `formatPhoneNumber(val)` with `formatPhoneNumber(val, country)`:

- Strip non-digits and cap at 15.
- For `TN`, keep the existing `xx xxx xxx` display and strip a typed `00216`/`216` prefix, exactly as the current code does.
- For every other country, group digits in threes with spaces.
- The input, paste and keydown handlers pass `currentCountry`.
- Change `maxlength="10"` to `maxlength="18"` and `inputmode="numeric"` to `inputmode="tel"`.

- [ ] **Step 8: Build the localized payload**

Replace `readOrder()` with:

```js
function readOrder() {
  const data = new FormData(orderForm);
  const value = (name) => String(data.get(name) || "").trim();
  const name = value("contact_name");
  const pack = PACKS[value("pack")] ? value("pack") : "complet";
  const country = value("country") || currentCountry;
  const dial = (window.ACADEX_COUNTRIES[country] || {}).dial || "";
  const national = value("phone");
  const price = priceFor(pack);
  return {
    pack,
    billing: "once",
    contact_name: name,
    school_name: name,
    phone: AcadexOrder.normalizePhone(dial, national) || national,
    country,
    currency: price.currency,
    amount_minor: price.amountMinor,
    quote: price,
    website: value("website"),
    lang: currentLang,
  };
}
```

Replace `invalidOrderField` with:

```js
function invalidOrderField(order) {
  if (order.contact_name.length < 2) return "contact_name";
  const digits = order.phone.replace(/\D/g, "");
  if (!order.phone.startsWith("+") || digits.length < 8 || digits.length > 15) return "phone";
  return null;
}
```

Update `FIELD_ERRORS` to map the worker's new fields:

```js
const FIELD_ERRORS = {
  contact_name: "od_err_name",
  phone: "od_err_phone",
  country: "od_err_country",
  currency: "od_err_country",
  amount_minor: "od_err_country",
};
```

In the submit handler, after `invalidOrderField`, build the payload:

```js
const payload = AcadexOrder.buildOrderPayload({
  pack: order.pack,
  contactName: order.contact_name,
  phone: order.phone,
  country: order.country,
  currency: order.currency,
  amountMinor: order.amount_minor,
  lang: order.lang,
  website: order.website,
});
if (!payload) return showOrderError(tr("od_err_phone"), "phone");
```

Send `JSON.stringify(payload)` instead of `JSON.stringify(order)`.

- [ ] **Step 9: Freeze the quote in the confirmation summary**

Change `orderSummary(order)` to use the quote captured at submission:

```js
function orderSummary(order) {
  const quote = order.quote || priceFor(order.pack);
  return tr("order_msg", {
    pack: PACKS[order.pack].label,
    price: quote.formatted,
    name: order.contact_name,
    phone: order.phone,
  });
}
```

`orderShown` already stores the whole `order`, so the summary keeps the submitted price even if the country changes later.

- [ ] **Step 10: Remove the Notion path**

- Delete the entire `// ── Notion Database Order Persistence ──` block, including `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `NOTION_PAGE_ID`, and `saveOrderToNotion`.
- In the submit handler, delete `notionPromise` and `notionRes`.
- The success condition becomes `if (cfSuccess)`; the fallback is `else`.
- Remove the client-side `const reference = \`ACX-O-${...}\`` line; the worker's reference is the only reference. Use `let finalRef = null;` and set it from `answer.reference` on `201`.
- Keep the 12 s abort timer, the 400 field mapping, and the 429 rate-limit message.

- [ ] **Step 11: Run the tests**

Run: `node --test tests/landing.test.js tests/order.test.js`

Expected: PASS. `grep -i notion index.html` returns nothing.

- [ ] **Step 12: Manual order round-trip before the worker change**

Serve the page, choose France, open Complet, enter `06 12 34 56 78`, submit. In DevTools → Network → `/v1/orders`, the request body must contain:

```json
{
  "pack": "complet",
  "billing": "once",
  "phone": "+33612345678",
  "country": "FR",
  "currency": "EUR",
  "amount_minor": 12900,
  "lang": "fr"
}
```

The worker may ignore the new fields until Tasks 11–12; the order must still be accepted. The fallback summary (worker offline) must show `129 €`.

- [ ] **Step 13: Commit**

```bash
git add index.html tests/landing.test.js
git commit -m "feat: send localized order quote and remove Notion"
```

---

## Task 9: Dictionary Parity and Landing Documentation

**Files:**
- Modify: `tests/landing.test.js`
- Modify: `README.md`

**Interfaces:**
- No runtime interface. This task locks the three dictionaries together and documents the new operations.

- [ ] **Step 1: Add the dictionary parity tests**

Append to `tests/landing.test.js`:

```js
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
```

- [ ] **Step 2: Run the test**

Run: `node --test tests/landing.test.js`

Expected: PASS. If the parity test fails, add the missing key to all three dictionaries rather than deleting the test.

- [ ] **Step 3: Update the README structure and pricing sections**

In `README.md`:

- Replace the single-file description with: `index.html` plus `assets/countries.js`, `assets/rates.js`, `assets/localization.js`, `assets/order.js`, `api/geo.js`, `scripts/`, `tests/`.
- Replace the hardcoded price sentence with: prices come from `assets/localization.js`; TND/EUR/SAR/USD anchors are exact, other countries convert through USD from `assets/rates.js`, and every price element is driven by a `data-price` hook.
- Replace the language sentence with: language resolution is saved `acadex_lang` → browser language → country fallback → English; Arabic is RTL, French and English are LTR. The country is separate and is saved as `acadex_country`.
- Keep the order-hash links (`#order-*`) and the media/download notes.

- [ ] **Step 4: Update the Orders section**

Document:

- The payload now includes `country`, `currency`, `amount_minor`, and an E.164 `phone`.
- `amount_minor` uses the currency's minor units (TND 299000, EUR 12900, JPY 5900).
- The worker defaults missing fields to `TN`/`TND`/`0` for older pages; eight bare digits are Tunisian only when the country is `TN` or missing.
- The worker migration is `apps/backup-worker/migrations/0003-order-localization.sql` in the app repo; run it before deploying the worker that expects the columns.
- Notion is no longer used. The previously embedded token was public and **must be rotated** in Notion.
- The e-mail/phone/WhatsApp fallback remains.

- [ ] **Step 5: Add Data refresh and Testing sections**

````markdown
## Data refresh

- `node scripts/generate-countries.mjs` — only when the country dataset needs updating.
- `node scripts/generate-rates.mjs` — monthly is enough. Review the diff, run the tests, and commit the new dated snapshot.
- The page never calls a live FX API, so two visits on the same deploy always show the same price.

## Tests

```
node --test tests/
```

Covers country data, rate coverage, anchors/conversion/rounding/formatting, language and country resolution, phone normalization, the order payload, the geo endpoint and the static page hooks.
````

- [ ] **Step 6: Update the Deploy section**

Add:

- `api/geo.js` is a Vercel Node function; it reads `x-vercel-ip-country` and returns `{ country }`. On any other host, or when opened from disk, the page falls back to the browser region and the manual picker.
- The site still has no build step. Vercel's framework preset stays "None".
- Deploy order: D1 migration → worker → landing page. If the landing page ships first, orders still succeed but the quote fields are ignored; if the worker ships before the migration, inserts fail with 503 and the page shows the contact fallback.

- [ ] **Step 7: Commit**

```bash
git add tests/landing.test.js README.md
git commit -m "docs: document localized pricing, geo detection and order fields"
```

---

## Task 10: Worker Migration and Schema

**Files:**
- Create: `D:\School Management System\apps\backup-worker\migrations\0003-order-localization.sql`
- Modify: `D:\School Management System\apps\backup-worker\schema.sql`

**Interfaces:**
- Adds three nullable columns to `orders`: `country TEXT`, `currency TEXT`, `amount_minor INTEGER`.
- Existing rows stay valid; the worker fills the columns for new orders.

- [ ] **Step 1: Create the migration**

Create `apps/backup-worker/migrations/0003-order-localization.sql`:

```sql
-- Localized quote attached to a landing-page order (POST /v1/orders).
-- Existing rows keep NULLs; the worker defaults old pages to TN/TND/0.
ALTER TABLE orders ADD COLUMN country TEXT NULL;
ALTER TABLE orders ADD COLUMN currency TEXT NULL;
ALTER TABLE orders ADD COLUMN amount_minor INTEGER NULL;

-- Owner, BEFORE deploying the worker that writes these columns:
--   pnpm -C apps/backup-worker exec wrangler d1 execute acadex-registry --remote --file migrations/0003-order-localization.sql
CREATE INDEX IF NOT EXISTS orders_by_country ON orders (country, created_at);
```

- [ ] **Step 2: Update the canonical schema**

In `apps/backup-worker/schema.sql`, add these columns to the `orders` table, after `lang` and before `client_hash`:

```sql
  country       TEXT NULL,
  currency      TEXT NULL,
  amount_minor  INTEGER NULL,
```

- [ ] **Step 3: Verify both files carry the columns**

Run from `D:\School Management System`:

```powershell
Select-String -Path apps\backup-worker\migrations\0003-order-localization.sql,apps\backup-worker\schema.sql -Pattern "country|currency|amount_minor"
```

Expected: each file shows all three column names.

- [ ] **Step 4: Commit**

```bash
git add apps/backup-worker/migrations/0003-order-localization.sql apps/backup-worker/schema.sql
git commit -m "feat: add localized quote columns to orders"
```

---

## Task 11: Worker Order Validation and Phone Handling

**Files:**
- Modify: `D:\School Management System\apps\backup-worker\src\orders.ts`
- Modify: `D:\School Management System\apps\backup-worker\test\orders.spec.ts`

**Interfaces:**
- `OrderInput` gains:
  ```ts
  country: string;      // ISO 3166-1 alpha-2, uppercase
  currency: string;     // ISO 4217, uppercase
  amount_minor: number; // integer, 0 .. 1_000_000_000_000
  ```
- `parseOrder` defaults missing values to `TN`, `TND`, `0`; it refuses malformed values with the field name.
- `formatOrderAmount(order: Pick<OrderInput, "amount_minor" | "currency">): string` is exported for the Telegram notification.

- [ ] **Step 1: Update the test fixtures and expectations**

In `apps/backup-worker/test/orders.spec.ts`:

- Keep `VALID` as the old-page fixture (no new fields) so it proves the defaults.
- Add:
  ```ts
  const LOCALIZED = {
    ...VALID,
    phone: "+33 6 12 34 56 78",
    country: "FR",
    currency: "EUR",
    amount_minor: 12900,
  };
  ```
- In the first `parseOrder` test, add to the expected `value`:
  ```ts
  country: "TN",
  currency: "TND",
  amount_minor: 0,
  ```
- In the second test ("needs only the pack…"), add the same three defaults.
- Change the route test "stores the order…" to post `LOCALIZED` and assert:
  ```ts
  phone: "+33612345678",
  country: "FR",
  currency: "EUR",
  amount_minor: 12900,
  ```
- Import `formatOrderAmount` from `../src/orders`.

- [ ] **Step 2: Add the new validation tests**

Append inside `describe("parseOrder — what the form may send")`:

```ts
it("accepts a localized quote and uppercases its codes", () => {
  const parsed = parseOrder({ ...LOCALIZED, country: "fr", currency: "eur" });
  expect(parsed).toMatchObject({
    ok: true,
    value: { country: "FR", currency: "EUR", amount_minor: 12900, phone: "+33612345678" },
  });
});

it("defaults an older page to TN, TND and zero", () => {
  const parsed = parseOrder(VALID);
  expect(parsed).toMatchObject({
    ok: true,
    value: { country: "TN", currency: "TND", amount_minor: 0 },
  });
});

it.each([
  ["country", { ...VALID, country: "FRA" }],
  ["currency", { ...VALID, currency: "EURO" }],
  ["amount_minor", { ...VALID, amount_minor: -1 }],
  ["amount_minor", { ...VALID, amount_minor: 1.5 }],
  ["amount_minor", { ...VALID, amount_minor: "12900" }],
  ["phone", { ...LOCALIZED, phone: "55 518 492" }],
])("refuses a bad localized %s", (field, body) => {
  const parsed = parseOrder(body);
  expect(parsed.ok).toBe(false);
  expect(parsed).toMatchObject({ ok: false, field });
});

it("formats the quoted amount for the owner", () => {
  expect(formatOrderAmount({ amount_minor: 12900, currency: "EUR" })).toMatch(/129/);
  expect(formatOrderAmount({ amount_minor: 299000, currency: "TND" })).toMatch(/299/);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run from `D:\School Management System`:

```powershell
pnpm -C apps/backup-worker run test -- orders.spec.ts
```

Expected: FAIL on the missing `country`/`currency`/`amount_minor` fields and the missing `formatOrderAmount` export.

- [ ] **Step 4: Add the fields and validation to `orders.ts`**

- Add the three fields to `OrderInput` with the comments shown in Interfaces.
- Replace `normalizePhone(value)` with `normalizePhone(value, country)`:
  ```ts
  function normalizePhone(value: unknown, country: string): string | null {
    const raw = text(value);
    if (!raw || /[^\d+\s().-]/.test(raw)) return null;
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    // Eight bare digits are Tunisian only when the order says Tunisia.
    if (digits.length === 8 && (country === "TN" || !country)) return `+216${digits}`;
    if (digits.length === 8) return null;
    return `+${digits}`;
  }
  ```
- In `parseOrder`, after the contact name and before the phone:
  ```ts
  const country = text(o.country).toUpperCase() || "TN";
  if (!/^[A-Z]{2}$/.test(country)) return refuse("country", "Unknown country.");

  const currency = text(o.currency).toUpperCase() || "TND";
  if (!/^[A-Z]{3}$/.test(currency)) return refuse("currency", "Unknown currency.");

  const amount = o.amount_minor === undefined || o.amount_minor === null ? 0 : o.amount_minor;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000_000) {
    return refuse("amount_minor", "Invalid amount.");
  }
  ```
- Change the phone call to `normalizePhone(o.phone, country)`.
- Return `country`, `currency`, `amount_minor: amount` in `value`.
- Add the exported formatter:
  ```ts
  export function formatOrderAmount(order: Pick<OrderInput, "amount_minor" | "currency">): string {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: order.currency })
      .resolvedOptions().maximumFractionDigits;
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: order.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(order.amount_minor / 10 ** digits);
  }
  ```

- [ ] **Step 5: Run the tests and typecheck**

```powershell
pnpm -C apps/backup-worker run test -- orders.spec.ts
pnpm -C apps/backup-worker run typecheck
```

Expected: all `orders.spec.ts` tests pass; typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add apps/backup-worker/src/orders.ts apps/backup-worker/test/orders.spec.ts
git commit -m "feat: validate localized order fields and international phones"
```

---

## Task 12: Worker Storage and Telegram Amount

**Files:**
- Modify: `D:\School Management System\apps\backup-worker\src\orders.ts`
- Modify: `D:\School Management System\apps\backup-worker\src\worker.ts`
- Modify: `D:\School Management System\apps\backup-worker\test\orders.spec.ts`

**Interfaces:**
- `ORDER_INSERT_COLUMNS`: a 16-entry readonly tuple, in insert order:
  `reference, created_at, pack, billing, school_name, contact_name, phone, email, city, request_code, message, lang, country, currency, amount_minor, client_hash`.
- `orderInsertValues(order)`: returns the 16 values in the same order.
- `worker.ts` builds the INSERT from these, so columns and binds cannot drift.
- The Telegram notification includes `Montant : <formatted amount>` when `amount_minor > 0`.

- [ ] **Step 1: Add the alignment test**

In `apps/backup-worker/test/orders.spec.ts`, import `ORDER_INSERT_COLUMNS` and `orderInsertValues`, then add:

```ts
it("keeps insert columns and values aligned", () => {
  const parsed = parseOrder(LOCALIZED);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  const values = orderInsertValues({
    ...parsed.value,
    reference: "ACX-O-ABC234",
    created_at: "2026-11-20T00:00:00.000Z",
    client_hash: "hash",
  });
  expect(ORDER_INSERT_COLUMNS).toHaveLength(16);
  expect(values).toHaveLength(16);
  expect(values[ORDER_INSERT_COLUMNS.indexOf("country")]).toBe("FR");
  expect(values[ORDER_INSERT_COLUMNS.indexOf("currency")]).toBe("EUR");
  expect(values[ORDER_INSERT_COLUMNS.indexOf("amount_minor")]).toBe(12900);
  expect(values[ORDER_INSERT_COLUMNS.indexOf("client_hash")]).toBe("hash");
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
pnpm -C apps/backup-worker run test -- orders.spec.ts
```

Expected: FAIL because `ORDER_INSERT_COLUMNS` and `orderInsertValues` are not exported.

- [ ] **Step 3: Add the column/value helper to `orders.ts`**

```ts
export const ORDER_INSERT_COLUMNS = [
  "reference", "created_at", "pack", "billing", "school_name", "contact_name",
  "phone", "email", "city", "request_code", "message", "lang",
  "country", "currency", "amount_minor", "client_hash",
] as const;

export function orderInsertValues(
  order: OrderInput & { reference: string; created_at: string; client_hash: string },
): unknown[] {
  return ORDER_INSERT_COLUMNS.map((column) => order[column]);
}
```

- [ ] **Step 4: Use the helper in `worker.ts`**

- Import `ORDER_INSERT_COLUMNS`, `orderInsertValues`, and `formatOrderAmount`.
- Replace the local `ORDER_COLUMNS` string with:
  ```ts
  const ORDER_COLUMNS = ORDER_INSERT_COLUMNS.join(", ");
  const ORDER_PLACEHOLDERS = ORDER_INSERT_COLUMNS.map((_, index) => `?${index + 1}`).join(", ");
  ```
- Change the INSERT to:
  ```ts
  `INSERT INTO orders (${ORDER_COLUMNS})
   VALUES (${ORDER_PLACEHOLDERS})
   ON CONFLICT(reference) DO NOTHING`
  ```
- Replace the hand-written `.bind(...)` list with `.bind(...orderInsertValues(order))`.
- In `telegramNotifier`, add after the pack line:
  ```ts
  order.amount_minor > 0 ? `Montant : ${formatOrderAmount(order)}` : null,
  ```

- [ ] **Step 5: Run the worker tests and typecheck**

```powershell
pnpm -C apps/backup-worker run test
pnpm -C apps/backup-worker run typecheck
```

Expected: all tests pass, including the alignment test and the route test that stores `LOCALIZED`; typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add apps/backup-worker/src/orders.ts apps/backup-worker/src/worker.ts apps/backup-worker/test/orders.spec.ts
git commit -m "feat: store and notify the localized order amount"
```

---

## Task 13: End-to-End Verification and Deployment

**Files:**
- No code changes expected. If a check fails, fix it in the owning task and rerun.

- [ ] **Step 1: Run every automated check**

From `D:\Acadex`:

```powershell
node --test tests/
```

Expected: all landing tests pass (country data, rates, localization, geo, order helpers, static page checks, dictionary parity).

From `D:\School Management System`:

```powershell
pnpm -C apps/backup-worker run test
pnpm -C apps/backup-worker run typecheck
```

Expected: all worker tests pass; typecheck passes.

From `D:\Acadex`:

```powershell
Select-String -Path index.html -Pattern "notion" -CaseSensitive:$false
```

Expected: no output.

- [ ] **Step 2: Verify the local fallback**

Serve the landing page (`npx serve D:\Acadex`) and open it from `http://localhost:<port>`. Because there is no `/api/geo` locally, the browser region must drive the country. Check:

- A `fr-FR` browser → French, EUR (or the browser region's currency).
- An `ar-TN` browser → Arabic, TND.
- A `de-DE` browser → English, EUR (Germany is in the Europe anchor).
- Manually pick Japan → prices become whole JPY; pick Kuwait → three-decimal KWD; pick Tunisia → exact 150/249/299 DT.
- Reload after a manual choice: the choice persists and is not overwritten.

- [ ] **Step 3: Check the responsive matrix**

At 360 px and 390 px, in Arabic, French and English:

- No horizontal scroll on the page.
- The country chip is readable (name hidden, ISO code shown on narrow screens).
- The country dialog opens, scrolls, searches, and closes.
- The comparison table still scrolls horizontally; its price headers show the full localized price.
- The mobile order bar shows the localized Complet price.
- The order dialog fits; the country select and dial prefix are usable.

- [ ] **Step 4: Deploy in the safe order**

1. Apply the D1 migration:
   ```powershell
   pnpm -C apps/backup-worker exec wrangler d1 execute acadex-registry --remote --file migrations/0003-order-localization.sql
   ```
2. Deploy the worker:
   ```powershell
   pnpm -C apps/backup-worker run deploy
   ```
3. Deploy the landing page (push to the Vercel-connected branch, or `vercel --prod` from `D:\Acadex`).

Rationale: the page can ship after the worker because the worker accepts both old and new payloads; the worker must ship after the migration because its INSERT names the new columns.

- [ ] **Step 5: Verify `/api/geo` on the Vercel preview**

Open the preview deployment. In DevTools → Network, `/api/geo` must return `200` with `{ "country": "<your country>" }` and `Cache-Control: no-store`. Disable the request (or use a browser without it) and confirm the page still renders from the browser region.

- [ ] **Step 6: Run one real order round-trip**

On the preview:

1. Pick France in the country dialog.
2. Open Complet. The dialog must show `129 €`.
3. Enter a French mobile number such as `06 12 34 56 78`.
4. Submit.

Expected request body includes `country: "FR"`, `currency: "EUR"`, `amount_minor: 12900`, `phone: "+33612345678"`. The success step shows a reference. Read the order back:

```powershell
curl -H "x-orders-token: <ORDERS_TOKEN>" https://acadex-backup.zglm.workers.dev/v1/orders
```

Expected: the new row has `country = FR`, `currency = EUR`, `amount_minor = 12900`, and the E.164 phone. The Telegram notification (if configured) includes `Montant : 129 €`.

- [ ] **Step 7: Verify the fallback path**

Temporarily block `/v1/orders` in DevTools (or use a country/phone combination the worker rejects only after the page accepts it). Expected: the form shows the e-mail / phone / WhatsApp summary with the same localized price, and no order is silently lost.

- [ ] **Step 8: Rotate the exposed Notion token**

Removing the token from the page does not invalidate it. In Notion, revoke the old integration token and create a new one only if it is still needed outside this page. Record the rotation date in the README or the owner's notes.

- [ ] **Step 9: Commit any verification fixes**

If a check required a code or copy change:

```bash
git add <changed files>
git commit -m "fix: <what the verification caught>"
```

If nothing changed, this task ends without a commit.

---

## Execution Handoff

Plan complete. The implementation touches two repositories and deploys in a fixed order (migration → worker → page). The highest-risk tasks are Task 7 (price hooks across the page) and Task 12 (column/bind alignment), so a fresh reviewer per task is worth the cost. Recommended execution: **subagent-driven development**, one task per subagent, with a whole-branch review at the end. The landing page and the worker can be reviewed in parallel only after Task 5 defines the order helper interface.

