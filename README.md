# Academy — Landing Page

Single-file static landing page (Arabic, RTL) for **Acadex**, the offline-first
school management desktop app for Windows.

## Structure

- `index.html` — the whole page (inline CSS/JS, no build step)
- No binaries: the download button points at the **stable update feed**
  (`https://acadex-backup.zglm.workers.dev/updates/latest`), which 302s to
  the current installer published to Cloudflare R2 by CI on every push to
  the app's `desktop` branch. The button can therefore never point at a
  stale exe file.
- `downloads/` (untracked) may hold a local bootstrap installer for idle
  installs; it stays out of git (GitHub refuses files >100 MB).

## Preview locally

Open `index.html` in any browser, or serve the folder:

```
npx serve D:\Acadex
```

## Deploy

- Git host: the owner pushes this folder to its own GitHub repo.
- Host: **Vercel** (framework "None", no build command) — commits there
  auto-deploy; the page HTML is version-agnostic, so nothing on the page
  needs to change when a new app version ships.
- The download button is a cross-absolute URL to the Cloudflare worker —
  it works from localhost, Vercel, or any static host without
  configuration.

## How updates flow (see the main repo design doc)

1. Owner pushes app changes to `desktop` (backend repo) → GitHub Actions
   builds the NSIS installer, stamps `2.0.0-alpha.<run_number>`, uploads
   `latest.yml` + exe + blockmap to R2.
2. Installed instances run `electron-updater` against the same `/updates/`
   URL, poll passively, download with percentage progress, and silently
   install once the super_admin has approved.
3. This page is only the front door: humans can always
   download the current installer from the same feed.
