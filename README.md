# Academy — Landing Page

Single-file static landing page (Arabic, RTL) for **Acadex**, the offline-first
school management desktop app for Windows.

## Structure

- `index.html` — the whole page (inline CSS/JS, no build step)
- The **packs block** (`#plans`) mirrors the app's three tiers — same names
  (Essentiel / Plus / Complet), same prices (300 / 450 / 600 DT), same
  one-time purchase. **`Complet` is the recommended pack**: it carries the
  `is-featured` class (the one bold element of the page: gold border, lifted,
  wider column, ribbon, its own value line and a gold button) and comes first
  on a phone. `Plus` (`is-plus`) and `Essentiel` stay quiet on purpose.
- The **comparison table** under the packs repeats the same content with the
  `Complet` column tinted gold (`cmp-pop-col`), plus a CTA row so nobody has
  to scroll back up to act. On a phone the three packs fit side by side —
  nothing scrolls sideways.
- **Ordering never leaves the page.** Every plan button (`data-order-pack`)
  opens the order form (`<dialog id="order-dialog">`): pack, school, name,
  phone, payment rhythm, optional city / e-mail / request code / note. See
  « Orders » below. WhatsApp is only a contact chip in the footer and one of
  the fallbacks if the form cannot be sent.
- A link can open the form directly: `…/#order` (Complet) or
  `…/#order-essentiel`, `…/#order-plus`, `…/#order-complet` — for a message,
  an ad or a QR code.
- Images: `assets/logo-128.png` (favicon + header) and `assets/hero.webp` /
  `assets/hero-960.webp` (hero, served through `<picture>`); the heavier
  originals stay in `assets/` as the source.
- Three languages (`ar` default and RTL, `fr`, `en`) live in the `i18n`
  object at the bottom of `index.html`; every key must exist in all three.
- No binaries: the download button points at the **stable update feed**
  (`https://acadex-backup.zglm.workers.dev/updates/latest`), which 302s to
  the current installer published to Cloudflare R2 by CI on every push to
  the app's `production` branch. The button can therefore never point at a
  stale exe file.
- The **version shown on the page is read live** from the same feed
  (`/updates/latest.yml` → `version:`). The feed answers CORS for these
  public routes, so the browser may read it; if the feed is unreachable the
  page keeps its static label.
- `downloads/` (untracked) may hold a local bootstrap installer for idle
  installs; it stays out of git (GitHub refuses files >100 MB).

## Orders (serverless)

The page stays static. The form posts JSON to the Cloudflare Worker that
already serves the update feed (`ORDER_ENDPOINT` in `index.html` →
`https://acadex-backup.zglm.workers.dev/v1/orders`); the Worker stores the
order in its D1 database and answers with a reference (`ACX-O-XXXXXX`) that
the visitor sees and can copy.

- **Before the Worker route is deployed** (or whenever it is unreachable)
  nothing is lost: the form shows the visitor a ready-made summary with
  e-mail / phone / WhatsApp buttons instead of an error.
- **Reading the orders** (owner only, token set once with
  `wrangler secret put ORDERS_TOKEN`):
  `curl -H "x-orders-token: <token>" https://acadex-backup.zglm.workers.dev/v1/orders`
- **Being notified** is optional: with the two Telegram secrets set on the
  Worker, each order is pushed to the owner's chat.
- Limits on the public route: 8 KB per request, 5 orders per hour per
  visitor, a hidden field that only bots fill. The visitor's IP address is
  never stored — only a fingerprint that changes every day.
- The deploy steps (D1 migration, secrets) are written at the top of
  `apps/backup-worker/migrations/0002-orders.sql` in the app repo.

## Preview locally

Open `index.html` in any browser, or serve the folder:

```
npx serve D:\Acadex
```

## Deploy

- Git host: the owner pushes this folder to its own GitHub repo
  (`github.com/Mohamed-ncib19/acadex-landing-page`).
- Host: **Vercel** (framework "None", no build command) — the domain is
  **https://acadex.pro/** (`acadex-landing-page.vercel.app` redirects there).
- The download button is a cross-absolute URL to the Cloudflare worker —
  it works from localhost, Vercel, or any static host without
  configuration.

### Publishing a change (one of the two)

1. **Git integration (recommended, then every push deploys itself)** — in the
   Vercel dashboard: *Settings → Git*, connect
   `Mohamed-ncib19/acadex-landing-page`, branch `main`, and make sure
   *Deployments → Automatic* is on. **As of the `packs` commit the repo has NO
   Vercel webhook, so a push alone does not deploy** — connect it once and it
   never has to be done again.
2. **Manual** — either
   - `vercel login` on the machine (the stored session is empty, so the CLI
     cannot deploy until it is re-authenticated) and then `vercel --prod` from
     this folder, or
   - the Vercel dashboard → *Deployments → New Deployment* with this folder
     dragged in.

Check what is live with `curl -sL https://acadex.pro/ | grep order-dialog` —
the order form is the marker of the current build.

> **To settle:** the app repo's `docs/PROJECT-STATUS.md` names
> `acadex-rust.vercel.app` as the live address and says `acadex.pro` belongs
> to a different product. One of the two documents is out of date — confirm
> the real domain before the next deploy.

## How updates flow (see the main repo design doc)

1. Owner pushes app changes to `production` (backend repo) → GitHub Actions
   builds the NSIS installer, stamps `2.0.0-alpha.<run_number>`, uploads
   `latest.yml` + exe + blockmap to R2. Only that branch publishes; every
   other branch builds and checks without touching the feed.
2. Installed instances run `electron-updater` against the same `/updates/`
   URL, poll passively, download with percentage progress, and silently
   install once the super_admin has approved.
3. This page is only the front door: humans can always
   download the current installer from the same feed.

## À propos

Fourniture de services de conception et de développement de solutions et de produits numériques au profit des particuliers et des entreprises dans différents secteurs d’activité, notamment la création et le développement de sites web, d’applications mobiles, de plateformes numériques et de systèmes informatiques sur mesure, ainsi que la fourniture de services d’exploitation, de maintenance, de mise à jour et de gestion des infrastructures techniques à l’aide des équipements informatiques (ordinateurs).
