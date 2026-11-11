# Academy — Landing Page

Single-file static landing page (Arabic, RTL) for **Acadex**, the offline-first
school management desktop app for Windows.

## Structure

- `index.html` — the whole page (inline CSS/JS, no build step)
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

Check what is live with `curl -sL https://acadex.pro/ | grep الباقات` — the
packs section is the marker of the current build.

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
