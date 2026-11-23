const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const LANGS = ["ar", "fr", "en"];
const template = read("src/page.html");
const script = read("assets/site.js");
const config = JSON.parse(read("site.config.json"));
const vercel = JSON.parse(read("vercel.json"));
const dict = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`src/i18n/${lang}.json`))]));
const page = Object.fromEntries(LANGS.map((lang) => [lang, read(`${lang}/index.html`)]));
const ARABIC = /[؀-ۿ]/;

// ── The published pages ─────────────────────────────────────────

test("the published files are up to date with their sources", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "build.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("each language has its own page, with its language and direction", () => {
  assert.ok(page.ar.includes('<html lang="ar" dir="rtl"'));
  assert.ok(page.fr.includes('<html lang="fr" dir="ltr"'));
  assert.ok(page.en.includes('<html lang="en" dir="ltr"'));
});

test("each page carries its texts in the raw HTML, not behind a script", () => {
  for (const lang of LANGS) {
    for (const key of ["hero_h1_part1", "hero_lead", "f_title", "p_title", "faq_q1", "faq_a1", "seg_school_t", "data_title", "about_title"]) {
      assert.ok(page[lang].includes(dict[lang][key]), `${lang} page misses ${key}`);
    }
    assert.equal(/data-i18n-(ph|aria|title|alt)=|data-wa-msg=|\{\{[A-Z_]+\}\}/.test(page[lang]), false, `${lang} page has an unresolved hook`);
  }
  assert.equal(page.fr.includes(dict.ar.hero_h1_part1), false, "the French page must not carry the Arabic headline");
  assert.equal(page.ar.includes(dict.fr.hero_h1_part1), false, "the Arabic page must not carry the French headline");
});

test("each page has its own title and description, in its own language", () => {
  const seen = new Set();
  for (const lang of LANGS) {
    const title = /<title>([^<]+)<\/title>/.exec(page[lang])[1];
    const description = /<meta name="description" content="([^"]+)">/.exec(page[lang])[1];
    assert.ok([...title].length >= 30 && [...title].length <= 60, `${lang} title is ${[...title].length} characters`);
    assert.ok([...description].length >= 120 && [...description].length <= 160, `${lang} description is ${[...description].length} characters`);
    assert.equal(ARABIC.test(title), lang === "ar", `${lang} title mixes languages`);
    assert.equal(ARABIC.test(description), lang === "ar", `${lang} description mixes languages`);
    assert.equal(seen.has(title), false);
    seen.add(title);
  }
});

test("canonical and hreflang: every page names itself and its two siblings", () => {
  for (const lang of LANGS) {
    const canonical = [...page[lang].matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(canonical, [`${config.origin}/${lang}/`], `${lang} canonical`);
    for (const other of LANGS) {
      assert.ok(page[lang].includes(`<link rel="alternate" hreflang="${other}" href="${config.origin}/${other}/">`), `${lang} → ${other}`);
    }
    assert.ok(page[lang].includes(`<link rel="alternate" hreflang="x-default" href="${config.origin}/${config.defaultLang}/">`));
  }
});

test("French is the default language, and the old single address leads to a language page", () => {
  assert.equal(config.defaultLang, "fr");
  const rootRules = vercel.redirects.filter((rule) => rule.source === "/");
  assert.ok(rootRules.length >= 1, "missing the redirect of the old address /");
  const fallback = rootRules[rootRules.length - 1];
  assert.equal(fallback.has, undefined, "the last rule for / must apply to everyone");
  assert.equal(fallback.destination, "/fr/");
  for (const rule of rootRules) assert.equal(rule.permanent, false, "a language choice is never a permanent redirect");
  assert.ok(read("index.html").includes("url=fr/"), "the root stub must lead to the default language");
});

test("language links are plain links, the page's own marked as current", () => {
  for (const lang of LANGS) {
    for (const other of LANGS) {
      const link = new RegExp(`<a class="lang-btn( active)?" data-lang="${other}" href="/${other}/" hreflang="${other}" lang="${other}"( aria-current="page")?>`).exec(page[lang]);
      assert.ok(link, `${lang} page misses the ${other} link`);
      assert.equal(Boolean(link[1] && link[2]), other === lang, `${lang} page: wrong current language`);
    }
  }
  assert.ok(script.includes('localStorage.setItem("acadex_lang"'), "a click on a language must be remembered");
});

test("the pages load one stylesheet and the scripts in order, nothing inline", () => {
  for (const lang of LANGS) {
    const sources = [...page[lang].matchAll(/<script src="\/(assets\/[a-z.]+)\?v=[0-9a-f]+" defer[^>]*><\/script>/g)].map((m) => m[1]);
    assert.deepEqual(sources, ["assets/analytics.js", "assets/countries.js", "assets/rates.js", "assets/localization.js", "assets/order.js", "assets/site.js"]);
    assert.ok(/<link rel="stylesheet" href="\/assets\/site\.css\?v=[0-9a-f]+">/.test(page[lang]));
    // Anything that is not data must come from a file: the content security policy refuses inline code.
    const inline = [...page[lang].matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]).filter((attrs) => !/\ssrc=/.test(attrs));
    for (const attrs of inline) assert.ok(/type="application\/(ld\+)?json"/.test(attrs), `inline script on the ${lang} page: <script${attrs}>`);
  }
});

test("every text the script asks for is embedded in the page", () => {
  const asked = [...script.matchAll(/\btr\("([a-z0-9_]+)"/g)].map((m) => m[1]);
  assert.ok(asked.length > 5);
  for (const lang of LANGS) {
    const embedded = JSON.parse(/<script type="application\/json" id="acadex-i18n">(.*?)<\/script>/s.exec(page[lang])[1]);
    for (const key of new Set(asked)) assert.equal(embedded[key], dict[lang][key], `${lang} page misses runtime text ${key}`);
  }
});

// ── The template and its hooks ──────────────────────────────────

test("every price location is driven by a hook", () => {
  for (const pack of ["essentiel", "plus", "complet"]) {
    assert.ok(template.includes(`data-price="${pack}"`), `missing data-price ${pack}`);
    assert.ok(template.includes(`data-price-full="${pack}"`), `missing data-price-full ${pack}`);
  }
  assert.ok(template.includes('data-old-price="plus"'));
  assert.ok(template.includes('data-old-price="complet"'));
  assert.ok(template.includes('data-old-price-full="plus"'));
  assert.ok(template.includes('data-old-price-full="complet"'));
  assert.ok(template.includes('data-price-template="all"'));
  assert.ok(template.includes('data-price-template="diff"'));
  assert.ok(template.includes('data-price-template="complet"'));
});

test("the published prices are the Tunisian ones, in each language's format", () => {
  assert.ok(/<span class="p-amount" data-price="essentiel">150<\/span>/.test(page.fr));
  assert.ok(/<span class="p-amount" data-price="plus">249<\/span>/.test(page.fr));
  assert.ok(/<span class="p-amount" data-price="complet">299<\/span>/.test(page.fr));
  // The amount and its currency are joined by a non-breaking space.
  assert.ok(/150\sDT/.test(page.fr));
  assert.ok(/TND\s150/.test(page.en));
});

test("the hardcoded currency label is gone and the country dialog exists", () => {
  assert.equal(template.includes('data-i18n="curr_dt"'), false);
  assert.ok(template.includes('id="country-chip"'));
  assert.ok(template.includes('id="country-dialog"'));
  assert.ok(template.includes('id="country-search"'));
  assert.ok(template.includes('id="country-list"'));
});

test("the order form uses the auto-detected country and the order helper", () => {
  assert.equal(template.includes('id="od-country"'), false);
  assert.ok(template.includes('id="od-dial"'));
  assert.ok(script.includes("AcadexOrder.normalizePhone"));
  assert.ok(script.includes("amount_minor"));
  assert.ok(template.includes('id="pricing-loc-hint"'));
});

test("order saves through server Notion endpoint without exposing secrets", () => {
  for (const source of [template, script, ...Object.values(page)]) {
    assert.equal(source.includes("NOTION_API_KEY"), false);
    assert.equal(source.includes("api.notion.com"), false);
    assert.equal(source.includes("saveOrderToNotion"), false);
  }
  assert.ok(script.includes("/api/order-notion"));
});

test("all three dictionaries carry the same keys", () => {
  assert.deepEqual(Object.keys(dict.ar).sort(), Object.keys(dict.fr).sort());
  assert.deepEqual(Object.keys(dict.fr).sort(), Object.keys(dict.en).sort());
});

test("every hook of the template names a text that exists", () => {
  const used = [...template.matchAll(/(?:data-i18n(?:-ph|-aria|-title|-alt)?|data-wa-msg)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(used.length > 100);
  for (const key of new Set(used)) assert.ok(key in dict.fr, `missing dictionary key: ${key}`);
});

test("owner placeholders never reach a visitor", () => {
  // Testimonials are real or absent: in the source, the block stays hidden while it holds a placeholder…
  const block = /<div class="testimonials"[^>]*>/.exec(template);
  assert.ok(block, "missing testimonials block");
  const end = template.indexOf("</section>", block.index);
  const waiting = template.slice(block.index, end).includes("TODO_OWNER");
  if (waiting) assert.ok(/\bhidden\b/.test(block[0]), "a testimonials block holding TODO_OWNER must be hidden");
  // …and the build leaves every placeholder out: none is published, not even hidden or in a comment.
  for (const [lang, html] of Object.entries(page)) {
    assert.equal(html.includes("TODO_OWNER"), false, `${lang}: a placeholder is published`);
    assert.equal(html.includes('class="testimonials"'), !waiting, `${lang}: the testimonials block is published only when it is real`);
  }
  // No text of the dictionaries may carry a placeholder: those are shown as they are.
  for (const lang of LANGS) assert.equal(JSON.stringify(dict[lang]).includes("TODO_OWNER"), false);
});

test("every download button goes through the site's own /download", () => {
  const rule = vercel.redirects.find((r) => r.source === "/download");
  assert.ok(rule, "missing /download redirect");
  assert.equal(rule.destination, "https://acadex-backup.zglm.workers.dev/updates/latest");
  assert.equal(rule.permanent, false, "the installer changes with every release: never a permanent redirect");
  assert.equal(/href="https:\/\/acadex-backup\.zglm\.workers\.dev\/updates\/latest"/.test(template), false);
  assert.ok(template.includes('href="/download"'));
});

test("robots.txt names the sitemap, and the sitemap lists every language page with its siblings", () => {
  const robots = read("robots.txt");
  assert.ok(robots.includes(`Sitemap: ${config.origin}/sitemap.xml`));
  assert.ok(/^User-agent: \*$/m.test(robots));
  const sitemap = read("sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  // The three home pages come first; the content pages follow (checked with the content pages below).
  assert.deepEqual(locs.slice(0, LANGS.length), LANGS.map((lang) => `${config.origin}/${lang}/`));
  for (const lang of LANGS) {
    const count = sitemap.split(`hreflang="${lang}" href="${config.origin}/${lang}/"`).length - 1;
    assert.equal(count, LANGS.length, `every entry must name the ${lang} page`);
  }
  assert.equal(sitemap.split('hreflang="x-default"').length - 1, locs.length);
});

test("fonts are served by the site, and every asset is addressed with its fingerprint", () => {
  const css = read("assets/site.css");
  for (const lang of LANGS) {
    assert.equal(/fonts\.(googleapis|gstatic)\.com/.test(page[lang]), false, `${lang} page still calls Google Fonts`);
    const refs = [...page[lang].matchAll(/(?:src|poster|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(refs.length >= 8);
    for (const ref of refs) {
      assert.ok(/\?v=[0-9a-f]{10}$/.test(ref) || ref.startsWith("/assets/fonts/"), `unversioned asset on the ${lang} page: ${ref}`);
      assert.ok(fs.existsSync(path.join(root, ref.split("?")[0])), `missing file: ${ref}`);
    }
  }
  assert.ok(page.ar.includes('rel="preload" as="font" type="font/woff2" href="/assets/fonts/cairo-arabic.woff2" crossorigin'));
  assert.ok(page.fr.includes('rel="preload" as="font" type="font/woff2" href="/assets/fonts/plus-jakarta-sans-latin.woff2" crossorigin'));
  for (const [, file] of css.matchAll(/url\("(\/assets\/fonts\/[^"]+)"\)/g)) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing font: ${file}`);
  }
  assert.equal(css.split("font-display: swap").length - 1, css.split("@font-face").length - 1);
  // A fingerprinted address never changes content: it may be cached for good.
  const immutable = vercel.headers.filter((rule) => rule.headers.some((h) => h.key === "Cache-Control" && /immutable/.test(h.value)));
  assert.ok(immutable.some((rule) => rule.source === "/assets/(.*)" && rule.has && rule.has[0].type === "query" && rule.has[0].key === "v"));
  assert.ok(immutable.some((rule) => rule.source === "/assets/fonts/(.*)"));
});

test("the demo video is never fetched before the visitor asks for it", () => {
  for (const lang of LANGS) {
    const videos = [...page[lang].matchAll(/<video\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(videos.length, 2);
    for (const video of videos) {
      assert.ok(/preload="none"/.test(video), "a video must not preload");
      assert.equal(/\sautoplay\b/.test(video), false, "a video must not autoplay");
      assert.ok(/poster="\/assets\/demo-poster\.webp/.test(video));
    }
  }
});

test("security headers are sent with every response", () => {
  const all = vercel.headers.find((rule) => rule.source === "/(.*)");
  assert.ok(all, "missing the rule for every path");
  const header = (name) => (all.headers.find((h) => h.key === name) || {}).value;
  assert.ok(/max-age=\d{7,}/.test(header("Strict-Transport-Security")));
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
  const csp = header("Content-Security-Policy");
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(/script-src 'self'(;|$)/.test(csp), "scripts come from the site only: no inline code, no third party");
  assert.ok(csp.includes("frame-ancestors 'none'"));
  // What the page really calls must be allowed, or it breaks silently.
  for (const [, origin] of script.matchAll(/fetch\("(https:\/\/[^/"]+)/g)) {
    assert.ok(csp.includes(origin), `the policy must allow ${origin}`);
  }
});

test("a page speaks one language: no Arabic left on the French and English pages", () => {
  for (const lang of ["fr", "en"]) {
    const arabic = [...page[lang].matchAll(/[^<>\n]*[؀-ۿ][^<>\n]*/g)].map((m) => m[0].trim());
    // The only Arabic words are the link to the Arabic page.
    assert.deepEqual(arabic, ["عربي"], `${lang} page`);
  }
});

test("the page outline: one h1, no skipped heading level, landmarks present", () => {
  for (const lang of LANGS) {
    const body = page[lang].slice(page[lang].indexOf("<body>"));
    const levels = [...body.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    assert.equal(levels.filter((level) => level === 1).length, 1, `${lang}: exactly one h1`);
    assert.equal(levels[0], 1, `${lang}: the first heading is the h1`);
    for (let i = 1; i < levels.length; i += 1) {
      assert.ok(levels[i] - levels[i - 1] <= 1, `${lang}: h${levels[i - 1]} is followed by h${levels[i]}`);
    }
    for (const tag of ["header", "nav", "main", "footer"]) assert.ok(body.includes(`<${tag}`), `${lang}: missing <${tag}>`);
    for (const id of ["top", "who", "features", "data", "how", "plans", "faq", "about", "contact"]) {
      assert.ok(new RegExp(`<section[^>]* id="${id}"`).test(body), `${lang}: missing section #${id}`);
    }
    // Every image says what it is, or says it is decoration.
    for (const [img] of body.matchAll(/<img\b[^>]*>/g)) assert.ok(/\salt="/.test(img), `${lang}: image without alt: ${img}`);
  }
});

const escapeText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Width and height of a JPEG, read from its frame header. */
function jpegSize(file) {
  const data = fs.readFileSync(file);
  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) throw new Error("not a JPEG marker");
    const marker = data[offset + 1];
    const length = data.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("no frame header");
}

test("a shared link shows a title, a description and a 1200 × 630 image in its language", () => {
  for (const lang of LANGS) {
    const meta = (name) => {
      const found = new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)">`).exec(page[lang]);
      assert.ok(found, `${lang}: missing ${name}`);
      return found[1];
    };
    const title = /<title>([^<]*)<\/title>/.exec(page[lang])[1];
    assert.equal(meta("og:title"), title);
    assert.equal(meta("og:url"), `${config.origin}/${lang}/`);
    assert.equal(meta("og:type"), "website");
    assert.equal(meta("twitter:card"), "summary_large_image");
    assert.ok(meta("og:description").length >= 100);
    assert.ok(meta("og:image:alt").length > 10);
    const image = meta("og:image");
    assert.equal(meta("twitter:image"), image);
    assert.ok(image.startsWith(`${config.origin}/assets/og-${lang}.jpg?v=`), `${lang}: the image address must be absolute`);
    const file = path.join(root, `assets/og-${lang}.jpg`);
    assert.deepEqual(jpegSize(file), { width: 1200, height: 630 });
    assert.ok(fs.statSync(file).size < 300 * 1024, "a share image stays light");
  }
});

test("structured data says what the page says, and nothing invented", () => {
  for (const lang of LANGS) {
    const blocks = [...page[lang].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 1, `${lang}: one structured data block`);
    const graph = JSON.parse(blocks[0][1])["@graph"];
    const node = (type) => graph.find((entry) => entry["@type"] === type);
    for (const type of ["Organization", "WebSite", "WebPage", "SoftwareApplication", "FAQPage"]) assert.ok(node(type), `${lang}: missing ${type}`);

    const software = node("SoftwareApplication");
    assert.deepEqual(software.offers.map((offer) => `${offer.price} ${offer.priceCurrency}`), ["150 TND", "249 TND", "299 TND"]);
    assert.ok(/Windows/.test(software.operatingSystem));
    assert.equal(node("WebPage").inLanguage, lang);

    // The FAQ of the data is the FAQ of the page, question for question.
    const shown = [...page[lang].matchAll(/<h3 class="faq-q">[\s\S]*?<span[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
    const told = node("FAQPage").mainEntity.map((entry) => entry.name);
    assert.ok(told.length >= 5);
    assert.deepEqual(told.map(escapeText), shown);
    for (const entry of node("FAQPage").mainEntity) assert.ok(entry.acceptedAnswer.text.length > 20);

    // No rating, review or award: there is none to show yet.
    assert.equal(/aggregateRating|"review"|ratingValue|"award"/.test(blocks[0][1]), false);
    assert.equal(/TODO_OWNER/.test(blocks[0][1]), false);
  }
});

test("an unknown address gets a page in the three languages, kept out of search results", () => {
  const notFound = read("404.html");
  assert.ok(notFound.includes('<meta name="robots" content="noindex">'));
  for (const lang of LANGS) {
    assert.ok(notFound.includes(dict[lang].nf_title), `the 404 page misses its ${lang} text`);
    assert.ok(new RegExp(`<section class="nf-block" lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">`).test(notFound));
    assert.ok(notFound.includes(`href="/${lang}/"`), `the 404 page must link to /${lang}/`);
  }
  // It is served from any depth: every address in it starts at the site root.
  for (const [, address] of notFound.matchAll(/(?:href|src)="([^"]+)"/g)) assert.ok(address.startsWith("/"), `relative address on the 404 page: ${address}`);
  assert.equal(/<script\b/.test(notFound), false);
});

// ── Measurement ─────────────────────────────────────────────────

test("the measurement script loads on every page, before the page script, and sends nothing unless a provider is set", () => {
  const analytics = read("assets/analytics.js");
  for (const lang of LANGS) {
    const tags = [...page[lang].matchAll(/<script src="\/assets\/([a-z]+)\.js\?v=[0-9a-f]{10}" defer([^>]*)><\/script>/g)].map((m) => [m[1], m[2]]);
    const names = tags.map(([name]) => name);
    assert.ok(names.includes("analytics"), `${lang}: analytics.js is missing`);
    assert.ok(names.indexOf("analytics") < names.indexOf("site"), `${lang}: analytics.js must load before site.js`);
    const data = tags.find(([name]) => name === "analytics")[1];
    const provider = (config.analytics || {}).provider || "";
    assert.equal(/data-provider=/.test(data), Boolean(provider));
  }
  // Every event the brief asks for has its name in the script.
  for (const name of ["download_click", "plan_request_open", "order_submit_success", "order_submit_failure", "whatsapp_click", "phone_click", "language_switch", "demo_video_play"]) {
    assert.ok(analytics.includes(`"${name}"`), `analytics.js does not send ${name}`);
  }
  // The order form is observed, never patched: the page script does not know the tracker.
  assert.equal(/acadexTrack|acadexSource/.test(script), false);
});

test("a configured analytics provider is allowed by the security policy", () => {
  const provider = (config.analytics || {}).provider || "";
  if (!provider) return;
  const origins = { plausible: ["https://plausible.io"], umami: ["https://cloud.umami.is", "https://api-gateway.umami.dev"], ga4: ["https://www.googletagmanager.com", "https://*.google-analytics.com"] }[provider];
  assert.ok(origins, `unknown provider ${provider}`);
  const csp = vercel.headers.find((rule) => rule.source === "/(.*)").headers.find((h) => h.key === "Content-Security-Policy").value;
  for (const origin of origins) assert.ok(csp.includes(origin), `add ${origin} to script-src / connect-src in vercel.json (see README, « Analytics »)`);
});

test("search engine verification tags appear only once the owner has set their codes", () => {
  const codes = config.verification || {};
  for (const lang of LANGS) {
    assert.equal(page[lang].includes('name="google-site-verification"'), Boolean(codes.google));
    assert.equal(page[lang].includes('name="msvalidate.01"'), Boolean(codes.bing));
  }
});

test("the default country is written in the page, so nothing is redrawn for it at load", () => {
  for (const lang of LANGS) {
    assert.ok(page[lang].includes(`data-country="${config.pricingCountry}"`), `${lang}: <html> must name the country of its prices`);
    // The button is named by its content: a phone shows the code, a wide screen the name,
    // and an aria-label could only match one of the two.
    const chip = /<button type="button" class="country-chip" id="country-chip"([^>]*)>([\s\S]*?)<\/button>/.exec(page[lang]);
    assert.ok(chip, `${lang}: the country button is missing`);
    assert.ok(!chip[1].includes("aria-label="), `${lang}: the country button must be named by what it shows`);
    assert.ok(/id="country-chip-name">[^<]+</.test(chip[2]) && /id="country-chip-currency">[^<]+</.test(chip[2]), `${lang}: the country and the currency must be written`);
    assert.ok(/<span class="sr-only">[^<]+<\/span>/.test(chip[2]), `${lang}: the button must say what it does`);
    assert.ok(/id="pricing-loc-text">[^<]+</.test(page[lang]), `${lang}: the « prices shown for » line must be written`);
  }
  assert.ok(script.includes('getAttribute("data-country")'));
});

// ── Content pages: segments, features, pricing, blog (scripts/content.mjs) ──

const { pathToFileURL } = require("node:url");
const loadBuild = () => import(pathToFileURL(path.join(root, "scripts", "build.mjs")).href);
const CONTENT_LANGS = ["fr", "ar"];
const length = (text) => [...text].length;
const headingLevels = (html) => [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
const metaOf = (html, name) => (new RegExp(`<meta name="${name}" content="([^"]*)">`).exec(html) || [])[1];

test("the pages the brief asks for exist in French and in Arabic, and the two versions match", async () => {
  const content = (await loadBuild()).contentPages({ drafts: true });
  const ids = [...new Set(content.all.map((p) => p.id))];
  for (const id of ["schools", "centers", "attendance", "timetable", "receipts", "payroll", "pricing"]) {
    assert.ok(ids.includes(id), `missing page: ${id}`);
    assert.equal(content.find(id, "fr").draft, false, `${id} must be published`);
  }
  assert.ok(content.all.filter((p) => p.lang === "fr" && p.meta.type === "article").length >= 4, "the blog needs 4 to 6 launch articles");
  for (const id of ids) {
    const [fr, ar] = CONTENT_LANGS.map((lang) => content.find(id, lang));
    assert.ok(fr && ar, `${id}: needs a French and an Arabic version`);
    assert.equal(fr.meta.type, ar.meta.type, `${id}: type`);
    assert.equal(fr.draft, ar.draft, `${id}: published in one language only`);
    assert.equal(fr.meta.pack, ar.meta.pack, `${id}: pack`);
    assert.equal(fr.meta.related, ar.meta.related, `${id}: related pages`);
    assert.equal(ARABIC.test(fr.body), false, `${id}: Arabic text in the French page`);
    assert.ok(ARABIC.test(ar.meta.slug) && ARABIC.test(ar.meta.h1), `${id}: the Arabic page needs its Arabic address and heading`);
  }
});

test("a content page is complete: language, address, sibling, one heading, described images, no script of its own", async () => {
  const build = await loadBuild();
  const content = build.contentPages({ drafts: true });
  const files = build.outputs({ drafts: true });
  for (const p of content.pages) {
    const file = content.fileOf(p);
    const html = files[file];
    assert.ok(html, `${file} is not rendered`);
    assert.ok(html.includes(`<html lang="${p.lang}" dir="${p.lang === "ar" ? "rtl" : "ltr"}"`), `${file}: language and direction`);
    assert.ok(html.includes(`<link rel="canonical" href="${content.urlOf(p, true)}">`), `${file}: canonical`);
    for (const lang of CONTENT_LANGS) {
      assert.ok(html.includes(`hreflang="${lang}" href="${content.urlOf(content.find(p.id, lang), true)}"`), `${file}: hreflang ${lang}`);
    }
    assert.ok(html.includes('hreflang="x-default"'), `${file}: x-default`);

    const title = /<title>([^<]*)<\/title>/.exec(html)[1];
    assert.ok(length(title) >= 30 && length(title) <= 65, `${file}: title is ${length(title)} characters (30–65)`);
    const description = metaOf(html, "description");
    assert.ok(length(description) >= 110 && length(description) <= 165, `${file}: description is ${length(description)} characters (110–165)`);

    const levels = headingLevels(html);
    assert.equal(levels.filter((level) => level === 1).length, 1, `${file}: one h1`);
    levels.forEach((level, index) => { if (index) assert.ok(level <= levels[index - 1] + 1, `${file}: heading level skipped (h${levels[index - 1]} → h${level})`); });
    for (const [img] of html.matchAll(/<img\b[^>]*>/g)) {
      assert.ok(/\salt="/.test(img) && /\swidth="\d+"/.test(img) && /\sheight="\d+"/.test(img), `${file}: ${img}`);
    }
    // No script of its own: the measurement file, and data.
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
    for (const attrs of scripts) assert.ok(/src="\/assets\/analytics\.js\?v=/.test(attrs) || /type="application\/ld\+json"/.test(attrs), `${file}: <script${attrs}>`);
    assert.equal(/<button\b|data-order-pack=|data-i18n|TODO_OWNER/.test(html), false, `${file}: a control that needs the page script, or a placeholder`);
    assert.equal(html.includes('content="noindex"'), p.draft, `${file}: only a draft is kept out of search engines`);

    // Structured data: valid, and its questions are the ones shown.
    const data = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
    const types = data["@graph"].map((node) => node["@type"]);
    assert.ok(types.includes("BreadcrumbList") && types.includes(p.meta.type === "article" ? "Article" : "WebPage"), `${file}: ${types}`);
    // The FAQ section, not the reading-aid <details> of the table of contents.
    const faqSection = /<section class="cp-faq">([\s\S]*?)<\/section>/.exec(html);
    const shown = faqSection ? [...faqSection[1].matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1].replace(/&amp;/g, "&")) : [];
    const faq = data["@graph"].find((node) => node["@type"] === "FAQPage");
    assert.deepEqual(faq ? faq.mainEntity.map((q) => q.name) : [], shown, `${file}: FAQ data and FAQ shown differ`);
    assert.equal(/aggregateRating|"review"/i.test(JSON.stringify(data)), false, `${file}: no rating may be invented`);
  }
});

test("segment and feature pages lead to the prices and to the order form; every article leads to a page", async () => {
  const build = await loadBuild();
  const content = build.contentPages({ drafts: true });
  const files = build.outputs({ drafts: true });
  for (const p of content.pages) {
    const html = files[content.fileOf(p)];
    const body = html.slice(html.indexOf('<div class="cp-body">'), html.indexOf("</article>"));
    const order = `href="/${p.lang}/#order-`;
    assert.ok(html.includes(order), `${p.file}: no link to the order form`);
    if (p.meta.type === "segment" || p.meta.type === "feature") {
      assert.ok(body.includes(`href="${content.pageHref("pricing", p.lang)}"`), `${p.file}: the text must link to the pricing page`);
      assert.ok(body.includes(order), `${p.file}: the text must link to the order form`);
    }
    if (p.meta.type === "article") {
      const targets = content.pages.filter((other) => other.lang === p.lang && other.meta.type !== "article").map((other) => `href="${content.urlOf(other)}"`);
      assert.ok(targets.some((target) => body.includes(target)), `${p.file}: an article must link to one relevant page`);
    }
    if (p.meta.type === "pricing") {
      for (const pack of ["essentiel", "plus", "complet"]) assert.ok(html.includes(`${order}${pack}"`), `${p.file}: order link for ${pack}`);
      for (const price of ["150", "249", "299"]) assert.ok(html.includes(price), `${p.file}: price ${price}`);
    }
  }
});

test("every internal link of every page leads somewhere that exists", async () => {
  const files = (await loadBuild()).outputs({ drafts: true });
  for (const [file, html] of Object.entries(files)) {
    if (!file.endsWith(".html")) continue;
    for (const [, href] of html.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)/g)) {
      if (href === "/download") continue;
      const target = decodeURIComponent(href).slice(1);
      if (target.startsWith("assets/")) assert.ok(fs.existsSync(path.join(root, target)), `${file}: ${href} does not exist`);
      else assert.ok((target.endsWith("/") ? `${target}index.html` : target) in files, `${file}: ${href} leads nowhere`);
    }
  }
});

test("a draft is never published: no file, no sitemap entry, no link from a published page", async () => {
  const build = await loadBuild();
  const all = build.contentPages({ drafts: true });
  const published = build.outputs();
  const sitemap = read("sitemap.xml");
  const drafts = all.all.filter((p) => p.draft);
  for (const draft of drafts) {
    const file = all.fileOf(draft);
    assert.equal(file in published, false, `${file} is a draft and is built`);
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} is a draft and is on disk`);
    assert.equal(sitemap.includes(all.urlOf(draft, true)), false, `${file} is a draft and is in the sitemap`);
    for (const [name, html] of Object.entries(published)) assert.equal(html.includes(`href="${all.urlOf(draft)}"`), false, `${name} links to the draft ${file}`);
  }
  // The sitemap lists exactly the published pages, each with its sibling.
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = Object.keys(published).filter((file) => /^(ar|fr|en)\/.*index\.html$/.test(file)).map((file) => `${config.origin}/${file.replace(/index\.html$/, "").split("/").map(encodeURIComponent).join("/")}`);
  assert.deepEqual([...locs].sort(), expected.sort());
});

test("the home pages link to the content pages of their language, and only to those", async () => {
  const content = (await loadBuild()).contentPages();
  for (const lang of LANGS) {
    for (const id of ["schools", "centers", "attendance", "timetable", "receipts", "payroll", "pricing"]) {
      const href = content.pageHref(id, lang);
      if (href) assert.ok(page[lang].includes(`href="${href}"`), `${lang} home page must link to ${id}`);
    }
    assert.equal(page[lang].includes("data-page="), false);
  }
  assert.equal(page.en.includes('class="more-link"'), false, "no English content page exists yet: the English home page must not link to one");
});

test("the top navigation is short, translated and free of empty groups", async () => {
  const build = await loadBuild();
  const content = build.contentPages({ drafts: true });
  const files = build.outputs({ drafts: true });

  const fr = files[content.fileOf(content.find("timetable", "fr"))];
  const frNav = /<nav class="cp-nav"[\s\S]*?<\/nav>/.exec(fr)[0];
  assert.equal((frNav.match(/data-nav-top/g) || []).length, 5, "FR content nav: five top-level items");
  assert.ok(frNav.includes(dict.fr.nav_solutions) && frNav.includes(dict.fr.nav_resources), "FR nav: the two groups");
  assert.equal(frNav.includes("Tarifs détaillés"), false, "the duplicate pricing link is gone");
  assert.ok(frNav.includes(content.pageHref("schools", "fr")), "FR nav: schools");
  assert.ok(frNav.includes(content.pageHref("centers", "fr")), "FR nav: centres");

  const ar = files[content.fileOf(content.find("timetable", "ar"))];
  const arNav = /<nav class="cp-nav"[\s\S]*?<\/nav>/.exec(ar)[0];
  assert.equal((arNav.match(/data-nav-top/g) || []).length, 5, "AR content nav: five top-level items");

  const enNav = /<nav class="nav-links"[\s\S]*?<\/nav>/.exec(files["en/index.html"])[0];
  assert.equal((enNav.match(/data-nav-top/g) || []).length, 4, "EN home: empty groups are hidden");
  assert.equal(enNav.includes("Solutions"), false, "EN has no empty Solutions group");
  assert.ok(enNav.includes(dict.en.nav_resources), "EN keeps resources");
  assert.equal(/href="\/en\/(ecoles|centres|tarifs|fonctionnalites)/.test(enNav), false, "EN nav has no dead content links");
  assert.ok(enNav.includes('href="#plans"'), "EN keeps the on-page plans link");
});

test("a content page has anchored sections, a table of contents and a media hero", async () => {
  const build = await loadBuild();
  const content = build.contentPages();
  const files = build.outputs();
  for (const id of ["schools", "centers", "attendance", "timetable", "receipts", "payroll"]) {
    const page = content.find(id, "fr");
    const html = files[content.fileOf(page)];
    assert.ok(html.includes('class="cp-hero cp-hero-with-media"'), `${id}: media hero`);
    assert.ok(html.includes('<aside class="cp-rail">'), `${id}: rail`);
    assert.ok(html.includes('<nav class="cp-toc"'), `${id}: table of contents`);
    assert.ok(html.includes('class="cp-chip"'), `${id}: meta chip`);
    const ids = [...html.matchAll(/<h2 id="(section-\d+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 2, `${id}: at least two sections`);
    assert.equal(new Set(ids).size, ids.length, `${id}: unique section ids`);
    for (const section of ids) assert.ok(html.includes(`href="#${section}"`), `${id}: TOC target ${section}`);
    assert.equal(/<button\b|data-i18n/.test(html), false, `${id}: no page controls`);
  }
});

test("pricing keeps the wide plan grid and has no TOC rail", async () => {
  const build = await loadBuild();
  const content = build.contentPages();
  const html = build.outputs()[content.fileOf(content.find("pricing", "fr"))];
  assert.ok(html.includes("cp-pricing-page"), "pricing marker");
  assert.ok(html.includes('id="plans"'), "plans section");
  assert.ok(html.includes("cp-pricing"), "plan grid");
  assert.equal(html.includes('<nav class="cp-toc"'), false, "no TOC on pricing");
});

test("a paragraph that is only a link becomes an action row", async () => {
  const build = await loadBuild();
  const content = build.contentPages();
  const html = build.outputs()[content.fileOf(content.find("schools", "fr"))];
  assert.ok(html.includes('class="cp-link-row"'), "standalone link row");
  assert.ok(html.includes('class="cp-action-link"'), "action link");
  assert.ok(html.includes(content.pageHref("receipts", "fr")), "action link target");
});
