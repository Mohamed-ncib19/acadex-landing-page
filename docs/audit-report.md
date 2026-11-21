# Landing page — audit, fixes, SEO: final report

Date: 2026-11-22 · Site: https://acadex-rust.vercel.app/ · Branch `main`, 28 commits (`7519fb2` → `b500191`), live.

Every commit is one task; `git log --oneline 373a451..main` lists them. The repo's `README.md` explains how the site is built.

## 1. What was done

### Phase 0 — conversion and trust

| # | Result | Commit |
|---|---|---|
| 0.1 | One label everywhere: « Acadex 2.0 », no « Beta » (owner's choice). | `7519fb2` |
| 0.2 | « Qui sommes-nous » section: who makes Acadex, Sousse, direct contact. A testimonials block waits in the source; it is not published while it is empty. | `37182cb`, `136af19` |
| 0.3 | « Avant d'acheter » block and FAQ: no trial (without a code the app stops at the activation screen), free demo before buying, no refund after activation (owner's terms). | `5752824` |
| 0.4 | Payment: cash and D17, stated in the FAQ and under the prices. Instalments removed: not offered (owner's choice). | `27775b1` |
| 0.5 | Crossed-out 450 / 600: the owner confirmed on 2026-11-22 that they are real former prices. Nothing changed. | — |
| 0.6 | Every download button goes to `/download` on the site, which redirects to the installer. No `workers.dev` address in the pages. | `afc8d9d` |
| 0.7 | « Vos données sont-elles en sécurité ? » section: where the data is, the local backup of every pack, the cloud backup, what to do when the PC dies. | `b7a893c` |
| 0.8 | On a phone, a bar stays at the bottom with WhatsApp first; the message is prefilled in the page's language. | `7a27e12` |
| 0.9 | Two blocks, « Pour les écoles privées » and « Pour les centres de soutien et de formation », three benefits each, each button opens the order form on a pack. | `3bc3b87` |

### Phase 1 — technical SEO

| # | Result | Commit |
|---|---|---|
| 1.1–1.5 | One complete page per language, `/ar/`, `/fr/`, `/en/`, written in the raw HTML by a small build. Correct `lang` and `dir`, one title and one description per language, canonical, hreflang with `x-default`. The language switch is three links. | `84dd936` |
| 1.6 | `robots.txt` and `sitemap.xml` (17 addresses, each with its language versions). | `64fa518` |
| 1.7–1.8 | Share card 1200 × 630 per language. Structured data: Organization, WebSite, SoftwareApplication with the three offers in TND, FAQPage. No rating, no review: none exists. | `3fedf48` |
| 1.9 | One `h1`, no skipped heading level, `nav` / `main` / `footer`, sections with ids. Accessibility failures fixed (contrast, names, labels). | `7fe4463`, `32bddff`, `b4f506c` |
| 1.10 | The demo video loads only on click (poster, `preload="none"`); its content is also written as text. Images have `alt`, `width`, `height`. | `0506116` |
| 1.11 | Fonts served by the site (Arabic subset), nothing render-blocking from a third party, scripts deferred, one-year caching of fingerprinted assets. Page weight 3.4 MB → about 0.2 MB. | `6b69232`, `5e02619` |
| 1.12 | Security headers on every response: CSP without inline script, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy, `X-Frame-Options`. | `c98bec8` |
| 1.13 | A 404 page in the three languages. The old address `/` redirects to the visitor's language (French by default) and keeps campaign parameters. | `4d80102` |

### Phase 2 — measurement

| # | Result | Commit |
|---|---|---|
| 2.1 | One tracker, ready for Plausible, Umami or GA4. **No provider is chosen yet, so nothing is sent anywhere.** | `3da65e5` |
| 2.2 | Ten events with one naming scheme: `download_click`, `plan_request_open`, `order_submit_success`, `order_submit_failure`, `whatsapp_click`, `phone_click`, `email_click`, `language_switch`, `demo_video_play`, `file_download`. Checked in a browser, not yet in a dashboard. | `3da65e5` |
| 2.3 | Places for the Google and Bing verification codes; the sitemap is ready to submit. | `3da65e5` |
| 2.4 | The campaign source (`utm_*`, Facebook and Google click ids, referrer) is attached to every event. It is **not** saved with the order: owner's decision, 2026-11-22. | `3da65e5` |

### Phase 3 — content

| # | Result | Commit |
|---|---|---|
| 3.1–3.4 | Seven pages, each in French and in Arabic (Arabic addresses in Arabic script): private schools, centres, attendance sheets, timetable, receipts, teacher pay, pricing. Each has its screenshot, its FAQ, links to the pricing page and to the order form. Every statement was checked against the app's code. | `4d5affc` |
| 3.5 | Five articles in French and Arabic, written as **drafts**: not published, not in the sitemap, until the owner has read them. A free pay spreadsheet (French and Arabic). | `82b0e06` |

No English content pages (optional in the brief).

### Phase 4 — off-page kit

`docs/marketing/` (`97b0293`): video title, description, chapters and tags in French and Arabic; directory description in three languages with a fact sheet; review-request messages; campaign links; six screenshots. `scripts/list_to_csv.py` converts a published list of schools (PDF, Excel) to CSV.

### Also done

| What | Commit |
|---|---|
| The order endpoint refuses bots (the form's hidden trap field), more than 5 requests a minute or 20 an hour from one visitor, and requests over 4 KB; Notion's error text no longer reaches the browser. Agreed with the owner. | `b63e649` |
| No `TODO_OWNER` placeholder reaches a published page, not even hidden. | `136af19` |
| `README.md` rewritten: it described a site that no longer existed. | `ebd2ce0`, `b500191` |
| A local preview server that applies `vercel.json` (`node scripts/preview.mjs`). | `9a9c99e` |

## 2. TODO_OWNER

### Decisions

1. **Analytics provider** — Plausible, Umami or GA4, and its site id. Until then task 2.1 is not complete (no dashboard). Steps: `README.md`, « Analytics: turning a provider on ».
2. **Attendance claim** — the home page says « Appel rapide à chaque séance » (and « Gestion des présences et retards » in the comparison table). The app prints monthly attendance sheets to fill by hand; it does not record who is absent. Change the sentence, or build the feature. The new pages already say it as it is.
3. **Cloud backup claim** — the home page and the app's plan list say « Sauvegarde Cloud automatique » and « chiffrée ». In the code, the copy is sent when the button is pressed, and no encryption of the content was found. Change the wording, or the app.
4. **Custom domain** — then set `origin` in `site.config.json`, rebuild, redirect the old address.
5. **Licence when the PC is replaced** — the page does not say whether the licence can be moved.
6. **Payment from outside Tunisia** — the page shows prices in other currencies; only cash and D17 are stated.
7. **Google Business Profile** — only with a real address or a service area.

### Content to supply

1. **Real testimonials and pilot schools** — text, name, role, school, with their written agreement. The block is in `src/page.html` (`id="testimonials"`).
2. **Legal identity** — the name to show, company name, matricule fiscal, address, year of creation (`src/page.html`, « about » section; `docs/marketing/listing.md`).
3. **Search Console and Bing codes** — `site.config.json` → `verification`.
4. **A native reader for the Arabic** — home page, the seven pages, the five drafts, the marketing texts.
5. **The five blog drafts** — read them (`DRAFTS=1 node scripts/preview.mjs`, then `/fr/blog/`), then remove `status: draft` in both language files.
6. **YouTube and Facebook addresses**, once created (they go into the structured data as `sameAs`).
7. **Chapter times of the video** (`docs/marketing/youtube.md`): right to about five seconds, to check once.
8. **The two pay spreadsheets** (`assets/files/`): open them once in Excel. Their formulas could not be recalculated here (no Excel on this machine).

## 3. Lighthouse, mobile

Before: the live site before this work (one address; the language followed the browser's). After: the live site after the deploy. Same laptop, same settings, measured within a day of each other.

Performance score, each run:

| Language | Before (2 runs) | After (3 runs) | After, median |
|---|---|---|---|
| French `/fr/` | 85, 75 | 92, 91, 87 | **91** |
| Arabic `/ar/` | 89, 74 | 95, 99, 100 | **99** |
| English `/en/` | 70, 81 | 93, 96, 76 | **93** |

The rest, the same in the three languages:

| | Before | After |
|---|---|---|
| Accessibility | 84 | **100** |
| Best practices | 88 | 88 |
| SEO | 100 | 100 |
| Page weight | 3.5 MB | 0.16 MB (0.22 MB in Arabic) |
| Largest paint (LCP) | 2.1 – 4.9 s | 1.0 – 2.7 s |
| Layout shift (CLS) | 0 | 0 |

New pages, one run each: `/fr/ecoles-privees/` and `/ar/الأسعار/` score 100 in the four categories.

How to read it: the target of 90 is met on the median of the three languages, not on every run. The score moves from one run to the next on this laptop — one English run gave 76 and one French run 87, minutes apart from runs at 96 and 92. The weight, the accessibility score and the layout shift do not move. An earlier series, when the laptop was less loaded, gave 89, 86 and 87 before (and 55 for French on a cold first run that downloaded 9 MB).

Best practices stays at 88 for one reason: the order form's phone field handles pasting itself (Lighthouse flags any field that does). It is part of the order form, so it was left as it is.

## 4. How to verify

On the live site:

```
B=https://acadex-rust.vercel.app

# 0.1  no « Beta », one label
curl -s $B/fr/ | grep -c -i beta                      # 0
curl -s $B/fr/ | grep -o "Acadex 2\.0" | sort -u      # Acadex 2.0
# 0.6  download through the site
curl -sI $B/download | grep -i -E "^HTTP|^location"   # 307 → the installer feed
curl -s $B/fr/ | grep -c workers.dev                  # 0
# 0.8  WhatsApp message prefilled
curl -s $B/fr/ | grep -o 'wa.me/21655518492?text=[^"]*' | sort -u

# 1.1–1.5  one page per language, in the raw HTML
for l in ar fr en; do curl -s $B/$l/ | grep -o -E '<html[^>]*>|<title>[^<]*</title>|rel="canonical" href="[^"]*"' ; done
curl -s $B/fr/ | grep -c 'rel="alternate" hreflang'   # 4 (ar, fr, en, x-default)
# 1.6
curl -s $B/robots.txt ; curl -s $B/sitemap.xml | grep -c "<url>"   # 17
# 1.7–1.8
curl -s $B/fr/ | grep -o 'property="og:image" content="[^"]*"'
curl -s $B/fr/ | grep -o '"@type":"[A-Za-z]*"' | sort | uniq -c
# 1.12
curl -sI $B/fr/ | grep -i -E "content-security|strict-transport|x-content-type|referrer-policy|permissions-policy|x-frame"
# 1.11  one-year caching of the assets
curl -sI "$B$(curl -s $B/fr/ | grep -o '/assets/site\.css?v=[a-f0-9]*' | sed -n 1p)" | grep -i cache-control
# 1.13
curl -s -o /dev/null -w "%{http_code}\n" $B/nothing-here                         # 404
curl -sI -H "Accept-Language: ar" $B/ | grep -i location                         # /ar/
curl -sI "$B/?utm_source=test" | grep -i location                                # /fr/?utm_source=test

# 3.x  an Arabic address, and drafts not published
curl -sI "$B/ar/%D8%A7%D9%84%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1/" | sed -n 1p         # 200
curl -s -o /dev/null -w "%{http_code}\n" $B/fr/blog/                             # 404

# order endpoint: both are refused, nothing is saved
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "content-type: application/json" \
  --data '{"pack":"plus","contact_name":"Check","phone":"+21600000000","website":"x"}' $B/api/order-notion   # 400
curl -s -X POST -H "content-type: application/json" \
  --data '{"pack":"plus","contact_name":"Check","phone":"123"}' $B/api/order-notion                          # field: phone
```

Links to tools:

- Rich results: https://search.google.com/test/rich-results?url=https%3A%2F%2Facadex-rust.vercel.app%2Ffr%2F
- Schema: https://validator.schema.org/#url=https%3A%2F%2Facadex-rust.vercel.app%2Ffr%2F
- Share card: paste a page's address into WhatsApp or https://www.opengraph.xyz/

In a browser:

| Task | Check |
|---|---|
| 0.2 | `/fr/#about` |
| 0.3, 0.4 | `/fr/#plans`, under the three packs: the payment line and « Avant d'acheter ». Then `/fr/#faq`: « Comment payer ? » and « Puis-je essayer Acadex avant de payer ? ». |
| 0.7 | `/fr/#data` |
| 0.9 | `/fr/#who` — each button opens the order form on its pack. |
| All of phase 0 | The same in `/ar/` and `/en/`. |
| 0.8 | Open `/fr/` on a phone: the bar at the bottom, WhatsApp first. |
| 1.9 | Lighthouse → Accessibility: 100 on the three home pages. |
| 1.10 | The video does not load until the poster is clicked (Network tab). |
| 2.2, 2.4 | Open `/fr/?utm_source=facebook&utm_campaign=test`, click a plan button, a WhatsApp link, the other language; then type `acadexEvents` in the console: each event is listed with its source. |
| 3.x | `/fr/ecoles-privees/`, `/fr/centres-formation-soutien/`, `/fr/fonctionnalites/paie-professeurs/`, `/fr/tarifs/`, and the Arabic versions from the language switch. |

In the repo: `node --test` (63 tests) and `node scripts/build.mjs --check`.

Checked on the live site on 2026-11-22 after the deploy: every line of the block above, the 17 addresses of the sitemap (all 200), and five pages in a phone-sized browser (no console error, no horizontal scroll, the order form opens).

**Not checked on the live site: a real order from start to finish.** It would have written a test line into the leads table. The code that saves a valid request did not change; send one request from the live page to confirm.

## 5. Risks, and what looked unusual

1. **Two claims on the page that the app does not match** — attendance « à chaque séance », and the cloud backup « automatique » and « chiffrée » (see section 2). Left untouched: the brief forbids changing product claims without a task.
2. **Possible issues in the app**, seen while checking the pages' statements against its code and not verified further: the « overdue » filter may always be empty, the monthly invoice renewal does not seem to be called from any screen, the late-fee setting does not seem to be used.
3. **The order endpoint's limit is modest.** The count of requests lives in the memory of the running function and starts again when Vercel restarts it. It stops a loop or a crude bot. If spam appears, the next step is a shared counter (Vercel KV, Upstash).
4. **An old note said a Notion key had once been public.** The previous README asked to rotate it. No key was found in the current files or in the 82 commits of the history. If that key was ever live, check that it was rotated in Notion.
5. **`/fr` and `/fr/` both answer.** Search engines are told which one counts by the canonical tag. A redirect was not added, to avoid touching how `/download` and `/api/` answer.
6. **Prices are written for Tunisia.** A visitor elsewhere sees the Tunisian prices for an instant, until the country is known.
7. **Rich results will show a notice for SoftwareApplication**: Google wants a rating or a review there. None exists, so none was written.
8. **Heavy files nobody loads** are still in the repo: `assets/hero.png` (1.5 MB), `hero.webp`, `hero-960.webp`. `assets/logo.png` (1.2 MB) is only for the logo kit. `assets/demo.mp4` is 18 MB and loads on click only.
9. **The installer still comes from `workers.dev`**, behind `/download`. Code signing and the SmartScreen test on a clean PC are the owner's.
10. **GA4 would need a consent banner** (it sets cookies); the site has none. Plausible and Umami do not need one.
11. **Section ids are now in English** (`#plans`, `#faq`…). An old link to a section of the single page lands at the top of the page instead. The `#order-…` links work.
12. **The ministry's lists could not be downloaded from here** (the addresses published in 2023 are dead). The converter was checked on a sample PDF made for the test, Arabic and French, three pages.
13. **`site.config.json` is served by the site.** It holds nothing private (the address, the contacts already on the page).
