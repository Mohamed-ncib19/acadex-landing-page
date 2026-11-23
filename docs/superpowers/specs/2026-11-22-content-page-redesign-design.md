# Acadex Content Pages and Navigation — Editorial Redesign

Date: 2026-11-22
Status: Approved (2026-11-22)
Repo: `D:\acadex`
Related: the landing site described in `README.md` and `docs/audit-report.md`

## 1. Intent

The home page looks like a finished product. The content pages — the private-schools
page, the two segment pages, the four feature pages, pricing and the blog articles —
still read like a technical document: one narrow column, uniform headings, permanent
blue underlined links, no summary, no visual rhythm.

A school director who arrives from Google on `/fr/ecoles-privees/` or
`/fr/fonctionnalites/emploi-du-temps/` should get the same trust, hierarchy and next
action as someone who arrives on the home page. The navigation should also stop being
a list of everything the site contains.

The supplied screenshot is a **reader / unstyled view** (serif text, default blue
links, no site CSS). A reader mode cannot be styled by `site.css`; that is not the bug
this design fixes. The live page does load its CSS, but it is still flat. This design
fixes the live experience and gives the content pages a real visual shell.

## 2. Who it is for

- A private-school director or administrator in Tunisia, working on one Windows PC,
  often offline, comparing paper, Excel and monthly subscriptions.
- A training-centre owner who pays teachers a percentage of collected fees.
- A French-speaking or Arabic-speaking visitor who scans a page on a phone before
  deciding whether to ask for a demo.

They are not looking for documentation. They are deciding whether this product
understands their daily work and whether it is worth a phone call.

## 3. Current state

### 3.1 Content pages

All content pages share one renderer, `scripts/content.mjs`:

- Pages are Markdown sources in `src/pages/<id>.<lang>.md`, in French and Arabic.
- The body is one column, max 820 px, 16.5 px text, 1.85 line-height.
- Every `h2` has the same weight and spacing; sections have no anchors.
- Body links are permanently underlined in light blue, including standalone
  "Voir le détail…" links.
- The hero is a kicker, an `h1`, a lead, two buttons, then a full-width screenshot
  below the text.
- There is no table of contents, no summary card, no reading rail.
- FAQ entries are bordered `<details>` rows; related pages are a plain list.
- Content pages may not load a page script. Only `analytics.js` and JSON-LD are
  allowed by the tests.

### 3.2 Navigation

The home page nav has eight top-level links:

`Fonctionnalités`, `Tarifs`, `Tarifs détaillés`, `Écoles privées`,
`Centres de soutien`, `Blog`, `Comparatif`, `FAQ`, `Contact`.

With the language pills, country chip and download button, it wraps onto two lines at
1280 px. `Tarifs` and `Tarifs détaillés` duplicate each other; `Blog` currently has no
published article. Content pages use a different five-link nav, so the two shells do
not match.

### 3.3 Constraints from the build and tests

- Static, pre-rendered HTML. No inline script or style (CSP).
- Content pages: no `<button>`, no `data-i18n`, no page script; only `analytics.js`
  and `application/ld+json`.
- One `h1` per page; heading levels may not skip.
- FR and AR versions of every page; RTL must work.
- All three dictionaries must carry the same keys.
- Titles 30–65 characters, descriptions 110–165.
- Images need `width` and `height` and an `alt`.
- Pricing reuses the `#plans` section of `src/page.html`; it must keep working.
- `node --test` (63 tests) and `node scripts/build.mjs --check` must pass.
- Baseline: 63/63 tests pass on 2026-11-22.

## 4. Goals, non-goals, anti-goals

### Goals

1. Make the first screen of a content page communicate: audience, product, offer and
   next action.
2. Make long pages comfortable to read on desktop and phone: shorter measure, larger
   type, clear section rhythm.
3. Make links look intentional: no permanent blue underlines in running text;
   standalone actions read as actions.
4. Fit the navigation on one line at 1280 px and 1440 px, with the same structure on
   the home page and content pages.
5. Make every FR and AR content page benefit from one template change.
6. Keep the conversion path visible at the top and at the end of every page.
7. Preserve SEO, accessibility, performance and all existing tests.

### Non-goals

- Rewriting the French or Arabic copy.
- New pages, new features, new prices, new claims.
- Redesigning the rest of the home page beyond its navigation.
- Publishing the draft blog articles.
- Changing the order form, analytics, geo endpoint or payment flow.
- Adding JavaScript to content pages.

### Anti-goals

- Wrapping every paragraph in a card; decoration must not compete with the text.
- Hiding content behind JavaScript or a script-only table of contents.
- Horizontal overflow on desktop or a nav that wraps to two lines.
- Removing underlines entirely: links must remain distinguishable on hover and focus.
- Adding a sticky element that covers the text on a small screen.
- Changing page titles, descriptions, prices, headings or FAQ text.
- Making Arabic pages a mirror of French spacing errors; use logical properties.

## 5. Approaches considered

### A. Shared editorial shell (chosen)

Keep the Markdown copy and the existing renderer, then replace the page shell:
two-column hero, sticky table of contents, numbered sections, card lists, calmer
links, stronger FAQ/related/CTA blocks. Consolidate the navbar into five items with
two dropdowns.

Trade-off: the improvement comes from structure and typography; pages remain
template-driven rather than bespoke.

### B. Bespoke page sections

Extend the Markdown with new block types (`::: checks`, `::: cards`, `::: steps`) and
rewrite each French and Arabic page to use them.

Trade-off: more distinctive pages, but roughly double the work, new syntax to
maintain, and every future page must learn the blocks.

### C. CSS-only polish

Keep the existing structure and change type, spacing, links, FAQ and navbar only.

Trade-off: fastest, but the page still reads as a document and the hero stays flat.

**Chosen: A.** It fixes the shell for every page at once, keeps the copy and the
tests, and leaves bespoke storytelling for a later round if it is ever needed.

## 6. Chosen design

### 6.1 Navigation

Top-level items on every page, in this order:

1. **Fonctionnalités** → home `#features`
2. **Tarifs** → pricing page
3. **Solutions ▾** → Écoles privées, Centres de soutien
4. **Ressources ▾** → Comparatif (`#compare`), FAQ (`#faq`), Blog (only when published)
5. **Contact** → home `#contact`

The duplicate "Tarifs détaillés" disappears. "Blog" becomes a resource. "Comparatif"
and "FAQ" leave the top level.

- Dropdowns use `<details class="nav-drop">` with a `<summary>` and a panel of links.
  No JavaScript is required on content pages. On desktop the panel is absolutely
  positioned under the summary; on mobile it expands inline inside the menu.
- The home page may add a small progressive enhancement in `site.js` to close the
  other dropdown when one opens; content pages must work without it.
- The current page is marked `aria-current="page"`. On schools/centres pages the
  **Solutions** summary gets a current style; on blog pages the **Ressources**
  summary does.
- Right side: language pills, country chip (home only), and one primary button —
  **Télécharger** on home, **Commander** on content pages. The country chip and
  download stay home-only; content pages keep language + order.
- `white-space: nowrap` on every top-level item. The full nav is shown at 1080 px and
  above; below that the home page uses its existing menu toggle, and content pages use
  a `<details>` mobile menu with the same links (no script).
- A group with no available link is not rendered. French and Arabic therefore show
  five top-level items; English shows four (`Fonctionnalités`, `Tarifs`,
  `Ressources`, `Contact`) because English has no segment, feature, pricing or blog
  pages yet. `Tarifs` falls back to the home `#plans` anchor where the pricing page
  does not exist.
- On a content page the header keeps the brand, the mobile menu and the language
  pills. The **Commander** button is hidden at 760 px and below because the hero
  carries the same order button; this matches the current behaviour and keeps the
  390 px header on one line.
- No new font, no new image.

### 6.2 Content page shell

Desktop wireframe:

```
[breadcrumb]
┌─ hero ──────────────────────────────────────────────┐
│  kicker pill                            ┌─────────┐ │
│  H1                                     │ screen  │ │
│  lead                                   │  shot   │ │
│  [pack] [offline] [lifetime]            └─────────┘ │
│  [Commander] [WhatsApp]                             │
└─────────────────────────────────────────────────────┘
┌─ rail 210 ─┐  ┌─ content 660 ──────────────────────┐
│ Sur cette  │  │ 01  H2 …                            │
│ page       │  │ text · cards · table                │
│ · …        │  │ …                                   │
│ ┌────────┐ │  │ FAQ                                 │
│ │ pack   │ │  │ CTA                                 │
│ └────────┘ │  │ À lire aussi                        │
└────────────┘  └─────────────────────────────────────┘
```

- Page max width 1160 px; rail 200–220 px; gap 40–48 px; reading column max 660 px.
  At 17.5 px body type this is roughly 70–76 characters per line. The rail and the
  two-column hero appear at 960 px and above; below 960 px the page is a single
  column and the table of contents becomes a `<details>` block.
- Breadcrumb sits above the hero, 13 px, muted, with the current page in white.
- Hero:
  - Kicker as a pill: small blue dot + label, not plain text.
  - `h1`: `clamp(30px, 4.6vw, 46px)`, weight 900, line-height 1.15,
    letter-spacing -0.02em, max 22ch.
  - Lead: 18 px, line-height 1.75, muted, max 62ch.
  - Three meta chips under the lead: pack (e.g. "Pack Complet"), "100 % hors ligne",
    "Licence à vie". Small, bordered, not buttons.
  - Buttons: primary order button with a cart/arrow icon, secondary WhatsApp with its
    icon. Same destinations as today.
  - Screenshot: framed panel with a soft blue/gold ambient glow, 1 px border, radius
    16–20 px, caption below. On desktop it sits to the right of the copy; on phone it
    stacks after the buttons. No new image.
  - Pages without an image (pricing, articles) use a single column, max 760 px, no
    empty visual column.
- Rail (desktop only at 960 px and above, `position: sticky; top: 96px`):
  - **Sur cette page**: an ordered list of the page's `h2` sections, linked to stable
    anchors. Only shown when there are at least two sections.
  - **Pack card**: pack name, price, "Licence à vie", order link. Segment and feature
    pages only. Articles get no pack card; their rail is the table of contents only.
  - Below 960 px the rail becomes a `<details>` block labelled "Sur cette page"
    above the body.
- Body:
  - 17.5 px, line-height 1.75–1.8, colour near `#C7D2E0`, column max 660 px,
    roughly 70–76 characters per line.
  - `h2` 26–28 px, weight 800, with a small automatic ordinal (`01`, `02`, …) in
    primary blue and a hairline above the section. Section anchors get IDs.
  - `h3` 19 px, white.
  - Paragraph spacing 16–18 px; no drop caps, no justified text.
  - Unordered lists: subtle card rows with a check mark in a small circle. Ordered
    lists: numbered step rows with a round number badge.
  - Tables: rounded container, uppercase muted header, 1 px row separators, hover row.
  - Notes keep the gold left border.
  - Bold text is white; body copy stays muted.
- Links:
  - Running-text links: accent blue, no permanent underline; a 1 px low-opacity
    bottom border; on hover/focus the underline becomes solid and brighter.
  - A paragraph whose entire content is a single link becomes a standalone action
    row (`Voir le détail des paiements et des reçus →`) with a subtle background and
    an arrow that flips in RTL. The Markdown stays the same; the renderer adds the
    class.
- FAQ: section heading, `<details>` cards with a plus/minus indicator, open-state
  border and background, 16 px question, 15.5 px answer, comfortable padding.
- Related pages: two-column card grid on desktop, one column on phone. Each card
  shows the page title and an arrow; no long underline.
- Closing CTA: full-width gradient panel with a soft glow, title, text, order and
  WhatsApp buttons, plus three small trust chips: free demo, no payment at order,
  lifetime licence. No new claims beyond the existing copy.
- Blog index and articles reuse the same shell. Articles keep their date; the hero is
  single-column.
- **Pricing is a special case.** It keeps `.cp-wide` and its injected `#plans` section
  at the full 1160 px width: plan cards and the comparison table must not be squeezed
  into the reading column. Its hero is single-column, max 820 px; its prose body is
  max 720 px, centred; it has no table-of-contents rail (there is only one Markdown
  section before the plans). Nav, link styling, FAQ, related pages and CTA follow the
  same shell.

### 6.3 Typography and colour

- Use the existing Plus Jakarta Sans / Cairo stack and tokens.
- Body text uses `--text-muted` at a slightly lighter value for long reading.
- Blue is the action colour; gold is reserved for the pack/offer and notes. Do not
  introduce a third accent.
- No pure-white body text; headings can be white.
- No letter-spacing on Arabic; the Latin tracking applies only to Latin headings.

### 6.4 New dictionary keys

Add the same keys to `ar.json`, `fr.json` and `en.json`:

| Key | FR | AR | EN |
|---|---|---|---|
| `nav_solutions` | Solutions | الحلول | Solutions |
| `nav_resources` | Ressources | الموارد | Resources |
| `cp_toc` | Sur cette page | في هذه الصفحة | On this page |
| `cp_offline` | 100 % hors ligne | يعمل دون إنترنت | 100% offline |
| `cp_lifetime` | Licence à vie | ترخيص مدى الحياة | Lifetime licence |
| `cp_pack_chip` | Pack {pack} | باقة {pack} | {pack} pack |
| `cp_rail_pack` | Votre pack | باقتك | Your pack |
| `cp_menu` | Menu | القائمة | Menu |
| `cp_free_demo` | Démo gratuite | عرض تجريبي مجاني | Free demo |
| `cp_no_payment` | Aucun paiement à la commande | لا دفع عند الطلب | No payment at order |
| `cp_trust_lifetime` | Licence à vie pour un PC | ترخيص مدى الحياة لجهاز واحد | Lifetime licence for one PC |

Reuse existing keys where possible: `cp_order_pack`, `cp_order`, `cp_see_pricing`,
`cp_cta_title`, `cp_cta_text`, `cp_faq_title`, `cp_related`, `m_wa`, `nav_features`,
`nav_plans`, `nav_contact`, `cp_nav_schools`, `cp_nav_centers`, `cp_nav_blog`,
`nav_compare`, `nav_faq`.

### 6.5 Accessibility

- `<summary>` elements are keyboard-operable and have a visible focus ring.
- Dropdown summaries have clear labels; chevrons are decorative (`aria-hidden`).
- The table of contents is a `<nav aria-label="Sur cette page">`.
- The current page uses `aria-current="page"`.
- Links keep a visible focus ring and a hover underline; colour is not the only cue.
- Body text contrast is at least 4.5:1 on the dark background.
- RTL uses logical properties (`margin-inline`, `padding-inline`, `inset-inline`);
  arrows and chevrons mirror with `[dir="rtl"]`.
- No new motion; existing `prefers-reduced-motion` rules stay.

### 6.6 SEO and structured data

- One `h1`; h2/h3 hierarchy unchanged.
- Section IDs are generated from the heading text, prefixed and unique
  (`section-1`, `section-2`, …) so Arabic headings need no transliteration.
- The table of contents contains real links in the raw HTML.
- Mobile menu links are in the DOM (inside `<details>`), so they remain crawlable.
- Titles, descriptions, canonical, hreflang, JSON-LD and page copy do not change.
- No new indexable pages; drafts stay out of the sitemap.

### 6.7 Performance

- CSS and static HTML only; no new scripts on content pages.
- Reuse the existing screenshot and fonts; no new requests.
- Avoid heavy backdrop filters on large surfaces; use gradients and shadows.
- Images keep explicit dimensions to prevent layout shift.
- `content-visibility` rules for below-the-fold sections stay.

### 6.8 Responsive behaviour

| Width | Navigation | Content page |
|---|---|---|
| ≥ 1080 | Full 5-item nav, one line (4 on EN) | Rail + two-column hero |
| 960–1079 | Home menu toggle; content pages `<details>` menu | Rail + two-column hero |
| 761–959 | Menu; content pages `<details>` menu | Single-column hero, TOC details, content max 660 |
| ≤ 760 | Menu; language visible; download hidden ≤ 560; content order button hidden | Single column, TOC details, stacked cards |

The rail and the two-column hero share the 960 px breakpoint so no intermediate
width is left with a squeezed rail. The nav uses 1080 px because the five items,
language, country and download need the room. Test at 1440, 1280, 1080, 1024, 960,
900, 768 and 390 px, in FR and AR. The pricing page is tested at 1280 and 768 only
for its wide plan grid.

### 6.9 Files expected to change

- `scripts/content.mjs` — section IDs, TOC data, hero/layout, nav groups, related cards,
  CTA chips.
- `src/page.html` — home nav markup.
- `src/i18n/fr.json`, `ar.json`, `en.json` — new keys.
- `assets/site.css` — navbar, dropdowns, content shell, typography, links, cards, FAQ,
  related, CTA, responsive rules.
- `assets/site.js` — optional home-only dropdown refinement.
- Generated `fr/`, `ar/`, `en/` pages and `sitemap.xml` if the build changes them.
- `tests/landing.test.js` — only if a new invariant is worth enforcing (e.g. no nav
  label wraps is not testable; section IDs unique is).

No copy changes to `src/pages/*.md` are expected.

## 7. Acceptance criteria

1. At 1280 px and 1440 px, the top bar is one line on home and on content pages; no
   top-level label wraps.
2. Top-level navigation has five items in FR and AR and four in EN (empty groups are
   hidden); "Tarifs détaillés" is gone; Solutions and Ressources open without
   JavaScript on content pages.
3. A feature page and the schools page show: breadcrumb, pill kicker, two-column hero,
   framed screenshot, meta chips, TOC rail, numbered sections, card lists, FAQ cards,
   related cards, enhanced CTA.
4. Running-text links have no permanent solid underline; standalone links render as
   arrow actions.
5. The body column is max 660 px at 17.5 px type, roughly 70–76 characters per line.
6. Arabic pages mirror correctly; no overflow, no clipped arrows.
7. Content pages still contain no `<button>`, no `data-i18n` and no page script.
8. Pricing keeps its wide plan cards and comparison table, with no TOC rail.
9. `node scripts/build.mjs`, `node --test` and `node scripts/build.mjs --check` pass.
10. Before/after screenshots at 1440 px for `/fr/ecoles-privees/` and
    `/fr/fonctionnalites/emploi-du-temps/`, plus 1024 px, 390 px FR and 390 px AR.
11. The home page hero and sections below the nav are unchanged.

## 8. Decisions left to the builder

- Exact CSS values, shadows, icon paths and spacing within the ranges above.
- Whether all unordered lists become cards or only lists of four items or fewer;
  prefer the card treatment, but keep it subtle.
- Whether to add the home-only JS that closes other dropdowns; content pages must not
  depend on it.
- Whether the pack rail card shows the price or only the pack name and a link; the
  price is preferred if it does not crowd the rail.

## 9. Risks and mitigations

- **Card fatigue**: auto-styling every list can make long articles heavy. Keep card
  borders and backgrounds very subtle, and test on the longest page (`schools.fr.md`).
- **Dropdown without JS**: two dropdowns can stay open on content pages. Acceptable;
  they are independent `<details>` elements. The home page may close siblings in JS.
- **Sticky rail on short screens**: hide it below 960 px and use `<details>` instead.
- **Arabic headings and anchor IDs**: use numbered IDs, not transliteration.
- **Test breakage from `<details>` in nav**: the tests forbid `<button>`, not
  `<summary>`; keep `data-i18n` off content pages.
- **Reader mode**: cannot be controlled; this design improves the normal browser
  experience, not the reader overlay.

## 10. Rollout

1. Implement the template, CSS and i18n changes.
2. Build and run the full test suite.
3. Preview locally at the widths above, FR and AR.
4. Capture before/after screenshots.
5. Commit sources and generated files together.
6. Publish through the existing Vercel flow after approval.
