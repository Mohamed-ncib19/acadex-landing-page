# Off-page kit (phase 4)

Everything here is prepared material. Publishing it — pages, profiles, listings,
messages to schools — is the owner's. Nothing in this folder is deployed
(`docs/` is in `.vercelignore`).

| File | What it is for |
| --- | --- |
| [youtube.md](youtube.md) | Title, description, chapters and tags for the demo video, in French and Arabic. Also usable for the Facebook video post. |
| [listing.md](listing.md) | One-paragraph descriptions (FR, AR, EN), fact sheet and categories for software and business directories. |
| [reviews.md](reviews.md) | Messages to ask a pilot customer for a review, and what to do with the answer. |
| [campaign-links.md](campaign-links.md) | Ready-made links for Facebook, WhatsApp and YouTube, so each source shows up in the analytics. |
| `kit/` | Six screenshots of the app as JPG (1280 × 710, demo data). |
| `../../scripts/list_to_csv.py` | Turns the ministry's published list of authorized schools (PDF or Excel) into a CSV. |

## Logo and images

| Need | File |
| --- | --- |
| Logo, large | `assets/logo.png` (1254 × 1254) |
| Logo, profile picture | `assets/logo-512.png` (512 × 512) |
| Logo, small | `assets/logo-128.png` |
| Cover / share image | `assets/og-fr.jpg`, `assets/og-ar.jpg`, `assets/og-en.jpg` (1200 × 630) |
| Screenshots | `docs/marketing/kit/*.jpg` |
| Demo video | `assets/demo.mp4` (3 min 21 s, French interface) |

## Owner checklist

1. **YouTube** — create the channel, upload `assets/demo.mp4` twice (French title and description, Arabic title and description) or once with both descriptions. Text: [youtube.md](youtube.md).
2. **Facebook page** — profile picture `logo-512.png`, cover `og-fr.jpg` or `og-ar.jpg`, the short description of [listing.md](listing.md), the site address with the Facebook link of [campaign-links.md](campaign-links.md).
3. **Directories** — paste the description and the fact sheet of [listing.md](listing.md). Fill the fields marked `TODO_OWNER` first.
4. **Google Business Profile** — only with a real address where customers can be received, or as a service-area business. `TODO_OWNER`: the address, or the decision not to create one.
5. **Reviews** — after a pilot school has used the app for a few weeks, send the message of [reviews.md](reviews.md).
6. **Outreach list** — download the current list from the ministry's site, run `python scripts/list_to_csv.py <file.pdf> -o ecoles.csv`, and compare a few rows with the PDF. Who may be contacted, how, and what the rules on personal data require is the owner's to check.

## TODO_OWNER in this folder

- Legal name of the business, tax number, year of creation (directories ask for them).
- A real address, or the decision to list without one.
- The YouTube and Facebook addresses, once created (they can then be added to the site's structured data as `sameAs`).
