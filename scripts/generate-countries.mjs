import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE = "https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json";
const OUTPUT = fileURLToPath(new URL("../assets/countries.js", import.meta.url));
const MAGHREB = ["TN", "DZ", "MA", "MR"];
const CURRENCY_FIXES = { CKD: "NZD", CUC: "CUP" };

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`failed to fetch ${SOURCE}: ${response.status}`);
}
const countries = await response.json();

const data = {};

for (const country of countries) {
  const code = country.cca2;
  const currencies = country.currencies ? Object.keys(country.currencies) : [];
  if (!code || currencies.length === 0) continue;

  // CKD (Cook Islands dollar) is replaced by NZD; CUC (convertible peso) is obsolete.
  const currency = CURRENCY_FIXES[currencies[0]] || currencies[0];

  const idd = country.idd || {};
  let dial = (idd.root || "").replace("+", "");
  if (dial && Array.isArray(idd.suffixes) && idd.suffixes.length === 1) {
    dial += idd.suffixes[0];
  }
  // Skip entries without a usable dial code. AX (Åland) combines to "35818" in the
  // source data, which is longer than any real calling code, so it is dropped too.
  if (!dial || !/^\d{1,4}$/.test(dial)) continue;

  const languages = country.languages ? Object.keys(country.languages) : [];
  let lang = "en";
  if (MAGHREB.includes(code)) lang = "fr";
  else if (languages.includes("ara")) lang = "ar";
  else if (languages.includes("fra")) lang = "fr";

  data[code] = { currency, dial, lang };
}

const lines = Object.keys(data)
  .sort()
  .map((code) => {
    const { currency, dial, lang } = data[code];
    return `  ${code}: { currency: "${currency}", dial: "${dial}", lang: "${lang}" },`;
  });

const output = `(function (root, data) {
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.ACADEX_COUNTRIES = data;
})(typeof globalThis !== "undefined" ? globalThis : this, {
${lines.join("\n")}
});
`;

await writeFile(OUTPUT, output);
console.log(`wrote assets/countries.js with ${lines.length} countries`);
