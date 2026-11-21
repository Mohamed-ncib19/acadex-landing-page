# Acadex — landing site

The public site of **Acadex**, the offline school management app for Windows:
https://acadex-rust.vercel.app/

A static site with a small build of its own. The published files are committed;
the host serves the folder as it is.

## How it is made

```
src/page.html            the home page, with data-i18n hooks
src/i18n/{ar,fr,en}.json every text of the home page and the shared texts
src/pages/<id>.<lang>.md the content pages (segments, features, pricing, blog)
site.config.json         address of the site, contacts, analytics, verification codes
        │
        ▼  node scripts/build.mjs
ar/ fr/ en/              one pre-rendered page per language, plus the content pages
index.html 404.html sitemap.xml robots.txt
```

- `assets/site.css`, `assets/site.js` and the other assets are addressed with a
  fingerprint (`?v=…`), so they are cached for a year and never served stale.
- No inline script: the security policy (`vercel.json`) refuses it.
- The home page of each language is complete in its raw HTML (texts, prices of
  the default country, structured data). The script only adds behaviour: the
  order form, the country picker, the demo video.

## Commands

| Command | What it does |
| --- | --- |
| `node scripts/build.mjs` | Writes the published files |
| `node scripts/build.mjs --check` | Fails when a published file is out of date |
| `node --test` | Runs the tests (they also run the check above) |
| `node scripts/preview.mjs` | Serves the site on http://localhost:4173 with the redirects and headers of `vercel.json` |
| `DRAFTS=1 node scripts/preview.mjs` | Same, and shows the draft articles (nothing is written) |
| `ORDERS=fake node scripts/preview.mjs` | Same, and the order form succeeds without saving anything |
| `GEO=FR node scripts/preview.mjs` | Same, as a visitor from France |
| `node scripts/og.mjs` | Redraws the share images `assets/og-{ar,fr,en}.jpg` (needs Chrome) |
| `node scripts/generate-rates.mjs` | Refreshes the exchange-rate snapshot (monthly is enough) |
| `node scripts/generate-countries.mjs` | Refreshes the country list (rarely) |

After any change to a source: build, test, commit the sources **and** the
published files together.

## Pages

| Address | Source |
| --- | --- |
| `/` | Redirects to `/ar/`, `/en/` or `/fr/` from the browser's language (`vercel.json`); the campaign parameters are kept |
| `/ar/` `/fr/` `/en/` | `src/page.html` + `src/i18n/<lang>.json` |
| `/fr/ecoles-privees/` · `/ar/مدارس-خاصة/` | `src/pages/schools.<lang>.md` |
| `/fr/centres-formation-soutien/` · `/ar/مراكز-الدروس-والتكوين/` | `src/pages/centers.<lang>.md` |
| `/fr/fonctionnalites/…/` · `/ar/الميزات/…/` | `attendance`, `timetable`, `receipts`, `payroll` |
| `/fr/tarifs/` · `/ar/الأسعار/` | `src/pages/pricing.<lang>.md` + the `#plans` section of the home page |
| `/fr/blog/…/` · `/ar/المدونة/…/` | the articles (`type: article`) |
| `/download` | Redirects to the installer feed |

### Writing or changing a content page

A page is a Markdown file with a few settings on top; the format is described at
the top of `scripts/content.mjs`. Two files with the same `<id>` are the same
page in two languages and name each other (`hreflang`). The home pages link to a
page only in the languages where it exists — there are no English content pages
yet, so the English home page links to none.

Rules the tests enforce: a French and an Arabic version of every page, a title
of 30–65 characters, a description of 110–165, one `h1`, every segment and
feature page links to the pricing page and to the order form, every article
links to one page of the site, every internal link leads somewhere.

### Publishing an article

The five launch articles are **drafts** (`status: draft`): not built, not in the
sitemap, not linked. To publish one, after reading it:

1. `DRAFTS=1 node scripts/preview.mjs`, open `/fr/blog/`.
2. Remove the `status: draft` line in its `.fr.md` **and** its `.ar.md`.
3. `node scripts/build.mjs`, `node --test`, commit.

The blog index and the « Blog » links appear with the first published article.

## Prices

Prices come from `assets/localization.js`: the TND, EUR, SAR and USD amounts are
set by hand, other currencies convert through USD from the dated snapshot in
`assets/rates.js`. The page never calls a live exchange-rate service. The pages
are written with the prices of `pricingCountry` (Tunisia); a visitor elsewhere
gets their own once `/api/geo` has answered.

## Orders

Every plan button opens the order form (`<dialog id="order-dialog">`); a link
can open it too (`/fr/#order-plus`). The form asks for a name and a phone and
posts to `api/order-notion.js`, a Vercel function that writes the request into a
Notion database and answers with a reference. If the request cannot be saved,
the visitor gets a ready-made summary with e-mail, phone and WhatsApp buttons.

Environment variables on Vercel: `NOTION_API_KEY`, `NOTION_DATABASE_ID`,
`NOTION_PAGE_ID`.

Known gaps of the endpoint, left as they are until the owner decides (the order
flow is not changed without asking): no rate limit, the hidden anti-bot field is
not checked on the server, Notion's error text is returned to the browser, and
default database and page identifiers are written in the file.

## Measurement

`assets/analytics.js` records these events, with one naming scheme:
`download_click`, `plan_request_open`, `order_submit_success`,
`order_submit_failure`, `whatsapp_click`, `phone_click`, `email_click`,
`language_switch`, `demo_video_play`, `file_download`. Each carries the language
and, when the visit came from a campaign link, `utm_source`, `utm_medium`,
`utm_campaign`. The order form is observed from the outside; its code is not
touched.

**With no provider set, nothing leaves the browser.** In the console,
`acadexEvents` lists what was measured and `acadexSource()` shows the campaign.

### Analytics: turning a provider on

1. In `site.config.json`:
   `"analytics": { "provider": "plausible", "site": "acadex-rust.vercel.app", "script": "" }`
   (`plausible`, `umami` or `ga4`; `site` is the domain for Plausible, the
   website id for Umami, the measurement id for GA4; `script` only for a
   self-hosted or per-site script address).
2. In `vercel.json`, add the provider's origins to the `Content-Security-Policy`:

   | Provider | `script-src` | `connect-src` |
   | --- | --- | --- |
   | Plausible | `https://plausible.io` | `https://plausible.io` |
   | Umami | `https://cloud.umami.is` | `https://cloud.umami.is https://api-gateway.umami.dev` |
   | GA4 | `https://www.googletagmanager.com` | `https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com` |

3. `node scripts/build.mjs`, `node --test` (a test fails if the policy does not
   allow the provider), commit, publish.
4. In the provider's dashboard, declare the events above as goals / custom events.

Plausible and Umami use no cookie. GA4 does: the site has no consent banner, so
GA4 should not be turned on without adding one.

### Search engines

`"verification": { "google": "<code>", "bing": "<code>" }` in `site.config.json`
adds the two ownership tags to every page. Then submit
`https://acadex-rust.vercel.app/sitemap.xml` in Google Search Console and Bing
Webmaster Tools.

### Campaign links

`docs/marketing/campaign-links.md`. The campaign is attached to the measured
events; it is **not** stored with the order itself (that changes the order
request and the leads table, and waits for the owner's decision).

## Tests

```
node --test
```

Country data, rates, prices and formatting, language and country resolution,
phone numbers, the order payload, the geo endpoint, and the published pages:
texts in the raw HTML, one language per page, headings, structured data, share
cards, security headers, caching, the 404 page, measurement, and the content
pages.

## Publishing

- GitHub: `Mohamed-ncib19/acadex-landing-page`. Vercel (framework « None », no
  build command) serves the `main` branch at https://acadex-rust.vercel.app/.
- A push to `main` publishes when the repository is connected in Vercel
  (*Settings → Git*). Otherwise: `vercel --prod` from this folder.
- `.vercelignore` keeps `src/`, `scripts/`, `tests/` and `docs/` off the host.
- A custom domain: change `origin` in `site.config.json`, rebuild, publish, then
  redirect the old address to the new one.
- `api/geo.js` reads Vercel's country header. On another host, or from disk, the
  page falls back to the browser's region and the manual picker.

After a deploy, check:

```
curl -sI https://acadex-rust.vercel.app/ | grep -i -E "^HTTP|^location"          # 307 to a language
curl -sI "https://acadex-rust.vercel.app/?utm_source=test" | grep -i "^location" # the query is kept
curl -sI https://acadex-rust.vercel.app/fr/ | grep -i -E "content-security|strict-transport"
curl -s  https://acadex-rust.vercel.app/sitemap.xml | grep -c "<url>"
curl -sI "https://acadex-rust.vercel.app/ar/%D8%A7%D9%84%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1/" | head -1   # an Arabic address answers 200
```

## The app's download and version

The download button goes to `/download`, which redirects to the update feed
(`https://acadex-backup.zglm.workers.dev/updates/latest`); the feed redirects to
the current installer, published by the app's CI on every push to its
`production` branch. The version shown on the page is read from the same feed;
if it cannot be reached, the page keeps its written label.

`downloads/` (ignored by git and by the host) may hold a local installer. Files
offered by the site itself live in `assets/files/`.

## Off-page material

`docs/marketing/`: video texts, directory listing, review request, campaign
links, screenshots. `scripts/list_to_csv.py` converts a published list of
schools (PDF, Excel) to CSV. `scripts/make_pay_template.py` rebuilds the pay
spreadsheets of `assets/files/`.

## À propos

Fourniture de services de conception et de développement de solutions et de produits numériques au profit des particuliers et des entreprises dans différents secteurs d’activité, notamment la création et le développement de sites web, d’applications mobiles, de plateformes numériques et de systèmes informatiques sur mesure, ainsi que la fourniture de services d’exploitation, de maintenance, de mise à jour et de gestion des infrastructures techniques à l’aide des équipements informatiques (ordinateurs).
