# Acadex Landing Page — Location-Aware Language and Pricing

Date: 2026-11-20
Status: Approved
Repo: `D:\Acadex`
Related product: Acadex 2.0.0-alpha.75 (`D:\School Management System`)

## 1. Intent

Every visitor to the Acadex landing page should see:

- a language that fits them (Arabic, French or English), and
- the three pack prices in their own country's currency.

Tunisia remains the reference market and the source of the TND price. The page
must not force a Tunisian price or an Arabic page on a visitor from France, the
Gulf, or anywhere else.

## 2. Who it is for

The buyer is a school director or administrator at a private school, training
centre or language centre. They are not an IT department. They work offline,
often from one Windows PC, and compare a one-time licence against paper,
spreadsheets and monthly subscriptions.

The core market is Tunisia and the Maghreb. The expansion markets are
French-speaking countries, the Gulf and international English-speaking schools.
The landing page is the front door; the product itself is still French-only and
shows TND in its plan cards. That mismatch is accepted for this round and
recorded in §9.

## 3. Current state

`D:\Acadex` is a single static `index.html` with inline CSS and JavaScript:

- Arabic is the hardcoded default (`<html lang="ar" dir="rtl">`); French and
  English are available through a manual switcher.
- Language is read from `localStorage` (`acadex_lang`) or defaults to Arabic.
  Browser language and visitor location are ignored.
- Prices are hardcoded in the cards, comparison table, FAQ, mobile CTA, order
  dialog, `PACKS` object and order messages. Only the currency label changes
  between languages.
- The order form asks for a name and a phone. It posts to a Cloudflare Worker
  and also writes to a Notion database with a token embedded in the page.
- The worker stores the pack, billing, name, phone and language, but no country,
  currency or amount. It treats eight bare digits as a Tunisian number.
- The page has 134 dictionary keys in each of `ar`, `fr` and `en`.

## 4. Goals, non-goals and anti-goals

### Goals

1. Detect the visitor's country on the first visit and show that country's
   currency.
2. Let the visitor correct the country; remember the choice.
3. Detect the language from the visitor's saved choice, then browser language,
   then country, then English.
4. Show every price on the page in the selected currency, from one source of
   truth.
5. Record the country, currency and quoted amount with the order.
6. Keep the page static and fast: no build step, no runtime framework, no live
   exchange-rate call on every visit.
7. Remove the exposed Notion token from the page.

### Non-goals

- Translating the desktop application. It stays French-only.
- Changing the app's plan-card prices from TND.
- Adding languages beyond Arabic, French and English.
- Online payment, invoicing or tax handling.
- Per-language SEO URLs.
- Automatic licence issuance.

### Anti-goals

- A visitor seeing a blank, `NaN`, `0` or TND price because a country or rate is
  missing.
- A non-Tunisian phone number being silently stored as `+216…`.
- Prices changing between two page loads because a live FX API returned a
  different rate.
- The country choice being overwritten by geolocation after the visitor has
  chosen.
- A JavaScript failure leaving the page invisible or the order form unusable.

## 5. Approaches considered

### 5.1 Pricing

| Approach | What it does | Trade-off |
|---|---|---|
| A. Convert TND to every currency | One base price, one rate per currency | Simple, but under-prices Europe and produces arbitrary numbers |
| B. Fixed price for every country | Owner maintains a full table | Full control, but 150+ rows and easy to drift |
| C. Hybrid anchors + conversion | Fixed prices for major markets, conversion for the rest | Controlled anchors, automatic long tail; chosen |

**Chosen: C.** It keeps the Tunisian price intact, prices Europe and the Gulf
deliberately, and still covers every country without a manual row per country.

### 5.2 Country detection

| Approach | What it does | Trade-off |
|---|---|---|
| Browser language/region only | `navigator.language` → region | No network, but wrong for expats and VPNs |
| Third-party IP API | `ipapi`/`ipwho` in the browser | No infrastructure, but ad-blockers, rate limits and a privacy dependency |
| First-party `/api/geo` on Vercel | Reads Vercel's country header | Accurate, no third party, one small serverless function; Vercel-specific |

**Chosen: first-party `/api/geo`, with browser region as the instant guess and
fallback.** The manual country selector always wins.

## 6. Chosen design

### 6.1 What the visitor sees

1. The page opens in the detected language and currency. A small
   **country · currency** chip sits next to the language switcher
   (“Tunisia · TND”).
2. Clicking the chip opens a searchable country dialog. Choosing a country
   updates every price and the order quote immediately. Language does not
   change automatically; the visitor can switch it separately.
3. The language switcher (AR / FR / EN) and the country choice are independent
   and both persist in `localStorage`.
4. Prices appear in the three cards, the comparison tabs and table, the FAQ
   answer, the “only +X more” line, the mobile order bar and the order dialog.
5. The order form still asks only for a name and a phone. A country-code
   selector sits beside the phone field. The order summary shows the localized
   price.

### 6.2 Language rules

Resolution order:

1. `localStorage.acadex_lang` if it is `ar`, `fr` or `en`.
2. The first supported browser language from `navigator.languages`
   (`ar…` → `ar`, `fr…` → `fr`, `en…` → `en`).
3. The country's fallback language.
4. English.

Country fallback:

- Arab countries → Arabic.
- Tunisia, Algeria, Morocco, Mauritania and Francophone countries → French.
- Everything else → English.

This means a Tunisian with a French browser sees French, while a Tunisian with
an Arabic browser sees Arabic. Currency always follows the country, not the
language.

The `<html lang>` and `dir` are set by a tiny inline script in `<head>` before
the page renders. A short `i18n-pending` class hides the body until translations
are applied, with a timeout fallback so a script error cannot leave the page
blank.

### 6.3 Country and currency data

`assets/countries.js` maps every ISO 3166-1 alpha-2 country to:

```js
{
  currency: "TND",   // ISO 4217
  dial: "216",       // international dialling code, digits only
  lang: "fr"         // fallback language: "ar" | "fr" | "en"
}
```

Country names and currency names are rendered with `Intl.DisplayNames`, so they
follow the current language. No flag images are used.

### 6.4 Anchor prices

| Market | Currency | Essentiel | Plus | Complet |
|---|---|---|---|---|
| Tunisia | TND | 150 | 249 | 299 |
| Eurozone | EUR | 59 | 99 | 129 |
| Gulf (SAR anchor) | SAR | 249 | 399 | 499 |
| International | USD | 59 | 99 | 129 |

The strike-through old prices preserve the current discount ratios:

- Plus: old = current × 450 / 249
- Complet: old = current × 600 / 299

Old prices are computed and rounded, never hardcoded per currency.

### 6.5 Conversion rules

`anchorFor(country)`:

- Tunisia → TND anchor.
- Algeria, Morocco, Libya, Mauritania → TND anchor.
- Eurozone and the rest of Europe → EUR anchor.
- Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman → SAR anchor.
- Everywhere else → USD anchor.

`assets/rates.js` stores a dated snapshot:

```js
{
  base: "USD",
  updated: "2026-11-20",
  units_per_usd: { USD: 1, EUR: 0.92, TND: 3.10, SAR: 3.75, ... }
}
```

Conversion is cross-rate through USD:

```text
amount_in_usd = anchor_amount / units_per_usd[anchor_currency]
local_amount  = amount_in_usd × units_per_usd[local_currency]
```

No live FX call is made. The file is refreshed periodically and committed. If a
rate is missing, the price falls back to the anchor currency; if the country is
unknown, it falls back to USD.

### 6.6 Rounding

Anchors are exact and are never rounded. Converted amounts are rounded to a
clean local number based on magnitude:

| Magnitude | Round to nearest |
|---|---|
| ≥ 1,000,000 | 100,000 |
| ≥ 100,000 | 10,000 |
| ≥ 10,000 | 1,000 |
| ≥ 1,000 | 100 |
| ≥ 100 | 10 |
| ≥ 10 | 5 |
| < 10 | 1, or 0.5 for three-decimal currencies |

Zero-decimal currencies (JPY, KRW, VND, etc.) stay integers. Three-decimal
currencies (KWD, BHD, OMR) may use 0.5. The currency's fraction digits come
from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`.

### 6.7 Formatting

`Intl.NumberFormat` with the current language and country (for example
`fr-TN`, `ar-SA`, `en-US`) handles symbol, placement and digits. TND has three
minor units, but whole-dinar prices must read **150 DT**, not **150.000 DT**;
the formatter uses `minimumFractionDigits: 0` and the currency's maximum.

The page renders prices from one `priceTable(country)` call. Each price object
carries the numeric text and currency symbol for the card layout, plus a full
formatted string for the comparison table, FAQ, mobile bar and order dialog.

### 6.8 Order flow

The landing page sends:

```json
{
  "pack": "complet",
  "billing": "once",
  "contact_name": "…",
  "school_name": "…",
  "phone": "+33612345678",
  "country": "FR",
  "currency": "EUR",
  "amount_minor": 12900,
  "lang": "fr"
}
```

- `amount_minor` is the displayed amount in the currency's minor units.
- The phone is E.164, built from the selected dial code and the national
  number.
- The page no longer writes to Notion. The Cloudflare Worker is the only order
  store; the existing e-mail/phone/WhatsApp fallback remains.
- The worker validates `country` (ISO 3166-1 alpha-2), `currency` (ISO 4217) and
  `amount_minor` (integer, non-negative). Missing fields default to `TN`, `TND`
  and `0` so an older page can still order.
- Eight bare digits are treated as Tunisian only when the country is `TN` (or
  missing). A non-Tunisian order must send an international number.
- The Telegram notification includes the localized amount.

### 6.9 Security

The page currently embeds a Notion API token in client-side JavaScript and
writes orders directly to Notion. This is removed. The token must be rotated by
the owner even after removal, because it has been publicly readable.

### 6.10 SEO and performance

This is client-side localization on one URL. Search engines will see the
default page, not per-language variants. Per-language SEO is a non-goal for this
round; if organic French/English search becomes important, add `/fr` and `/en`
routes later.

The new data files are plain scripts, not JSON fetched at runtime, so the page
still works when opened directly from disk. They are cacheable and add only a
few kilobytes.

## 7. Files and responsibilities

| File | Responsibility |
|---|---|
| `index.html` | Layout, dictionaries, page state, price rendering, country dialog, order form |
| `assets/countries.js` | Country → currency, dial code, fallback language |
| `assets/rates.js` | Dated USD cross-rates |
| `assets/localization.js` | Country/language detection, anchor selection, conversion, rounding, formatting |
| `assets/order.js` | Phone normalization and order-payload building |
| `api/geo.js` | Vercel function returning `{ country }` from `x-vercel-ip-country` |
| `scripts/generate-countries.mjs` | Refresh `assets/countries.js` from a public country dataset |
| `scripts/generate-rates.mjs` | Refresh `assets/rates.js` from a public FX snapshot |
| `tests/*.test.js` | Node built-in tests for data, localization, order and geo helpers |
| `README.md` | Operations: how to refresh data, deploy the geo endpoint, read orders |

The Cloudflare Worker change lives in the app repo:
`apps/backup-worker/src/orders.ts`, `src/worker.ts`, `schema.sql`, and
`migrations/0003-order-localization.sql`.

## 8. Verification

- `node --test tests/*.test.js` for data, localization, order and geo helpers.
- `pnpm -C apps/backup-worker run test` and `run typecheck` for the worker.
- Browser checks at 360 px and 390 px in Arabic, French and English.
- Price matrix checks: TN→TND, FR→EUR, GB→GBP, SA→SAR, AE→AED, DZ→DZD,
  MA→MAD, US→USD, JP→JPY, KW→KWD.
- One order round-trip with a French phone number.
- A Vercel preview check that `/api/geo` returns the country; local file preview
  must fall back to browser region.
- `grep -i notion index.html` returns nothing.

## 9. Accepted mismatch

The installed app is French-only and its plan cards show 150 / 249 / 299 DT.
A European customer who orders at €129 will later see DT inside the app. This
round does not change the app. Aligning the app's plan display and language is a
separate project.

## 10. Deployment notes

- `api/geo.js` requires Vercel. On any other host, the page falls back to the
  browser region and the manual selector.
- The worker migration must run before the worker that expects the new columns
  is deployed:
  `pnpm -C apps/backup-worker exec wrangler d1 execute acadex-registry --remote --file migrations/0003-order-localization.sql`.
- Refresh `assets/rates.js` periodically (monthly is enough); the page treats
  the amount as a quote that support confirms.
