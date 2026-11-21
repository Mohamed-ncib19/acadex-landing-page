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
    const sources = [...page[lang].matchAll(/<script src="\/(assets\/[a-z.]+)\?v=[0-9a-f]+" defer><\/script>/g)].map((m) => m[1]);
    assert.deepEqual(sources, ["assets/countries.js", "assets/rates.js", "assets/localization.js", "assets/order.js", "assets/site.js"]);
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
  // Testimonials are real or absent: the block stays hidden while it holds a placeholder.
  for (const html of [template, ...Object.values(page)]) {
    const block = /<div class="testimonials"[^>]*>/.exec(html);
    assert.ok(block, "missing testimonials block");
    const end = html.indexOf("</section>", block.index);
    if (html.slice(block.index, end).includes("TODO_OWNER")) {
      assert.ok(/\bhidden\b/.test(block[0]), "a testimonials block holding TODO_OWNER must be hidden");
    }
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
