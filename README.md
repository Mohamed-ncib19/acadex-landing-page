# أكادِكس — Landing Page

Single-file static landing page (Arabic, RTL) for **Acadex**, the offline-first
school management desktop app for Windows.

## Structure

- `index.html` — the whole page (inline CSS/JS, no build step)
- `downloads/Acadex-Setup-2.0.0-alpha.0.exe` — the Windows installer the page links to

## Preview locally

Open `index.html` in any browser, or serve the folder:

```
npx serve D:\Acadex
```

## Deploy (later)

Any static host works: the page references the installer with a **relative**
path (`downloads/Acadex-Setup-2.0.0-alpha.0.exe`), so hosting includes the
download as-is. For Cloudflare Pages: this folder is the output directory.
Large-exe note: some hosts cap file size (~100-200 MB on some plans) — if
needed, move the exe to a storage bucket (e.g. R2) and point the two download
anchors at the absolute URL.

## Updating the download

After releasing a new installer from the main repo:

1. Copy the fresh exe over `downloads/`
2. Update the two `href` links + the three «الإصدار …», «الحجم …» badges in
   `index.html`
