import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE = "https://open.er-api.com/v6/latest/USD";
const OUTPUT = fileURLToPath(new URL("../assets/rates.js", import.meta.url));

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`failed to fetch ${SOURCE}: ${response.status}`);
}
const payload = await response.json();

if (payload.result !== "success" || !payload.rates || typeof payload.rates !== "object") {
  throw new Error(`unexpected response from ${SOURCE}: result=${payload.result}`);
}

const rates = {};
for (const [code, value] of Object.entries(payload.rates)) {
  if (!/^[A-Z]{3}$/.test(code)) continue;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
  rates[code] = value;
}

const updated = payload.time_last_update_unix
  ? new Date(payload.time_last_update_unix * 1000).toISOString().slice(0, 10)
  : new Date().toISOString().slice(0, 10);

const lines = Object.keys(rates)
  .sort()
  .map((code) => `    ${code}: ${JSON.stringify(rates[code])},`);

const output = `(function (root, data) {
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.ACADEX_RATES = data;
})(typeof globalThis !== "undefined" ? globalThis : this, {
  base: "USD",
  updated: "${updated}",
  units_per_usd: {
${lines.join("\n")}
  }
});
`;

await writeFile(OUTPUT, output);
console.log(`wrote assets/rates.js with ${lines.length} currencies (updated ${updated})`);
