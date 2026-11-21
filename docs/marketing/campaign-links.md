# Campaign links

A link that carries `utm_source` tells the site where the visitor comes from.
The site keeps it for the visit (also across the language switch) and attaches
it to every measured event: plan request opened, request sent, WhatsApp click,
download click.

Use lower case, no spaces, and keep the same names from one post to the next.

| Where the link is posted | Link |
| --- | --- |
| Facebook page, organic post | `https://acadex-rust.vercel.app/?utm_source=facebook&utm_medium=social&utm_campaign=<name>` |
| Facebook ad | `https://acadex-rust.vercel.app/?utm_source=facebook&utm_medium=paid&utm_campaign=<name>` |
| Message sent on WhatsApp | `https://acadex-rust.vercel.app/?utm_source=whatsapp&utm_medium=message&utm_campaign=<name>` |
| WhatsApp status or group | `https://acadex-rust.vercel.app/?utm_source=whatsapp&utm_medium=group&utm_campaign=<name>` |
| YouTube description | `https://acadex-rust.vercel.app/fr/?utm_source=youtube&utm_medium=video&utm_campaign=demo` |
| A directory | `https://acadex-rust.vercel.app/fr/?utm_source=<directory>&utm_medium=listing` |

- `<name>`: the campaign, for example `rentree-2027` or `centres-sousse`.
- The address without a language (`/`) sends the visitor to Arabic, French or English according to the phone's language, and keeps the campaign.
- To send people straight to a page: `/fr/ecoles-privees/?utm_source=…`, `/fr/centres-formation-soutien/?utm_source=…`, `/fr/tarifs/?utm_source=…`.
- To open the request form directly on a pack: `/fr/?utm_source=…#order-plus`.

## What is recorded, and what is not

- **In the analytics** (once a provider is set in `site.config.json`): yes, on every event.
- **With the request itself, in the leads table**: not yet. That needs one more field in the request and in the leads table; it changes the order form's request, so it waits for the owner's go-ahead.
- A click from Facebook without `utm_source` is still recognised as `facebook` (from the click id Facebook adds).

## Check a link

Open it, then in the browser's console type `acadexSource()`: it shows what
was read from the link. `acadexEvents` lists the events measured on the page.
