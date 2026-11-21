// Draws the image shown when a link to the site is shared (1200 × 630), one per
// language: assets/og-ar.jpg, assets/og-fr.jpg, assets/og-en.jpg.
//
//   node scripts/og.mjs
//
// Needs a local Chrome or Edge (set CHROME_PATH if it is not found). Run it
// again when the texts of the card, the logo or the demo poster change, then
// run the build: the pages address the images with their fingerprint.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LANGS, dictionaries } from "./build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fileUrl = (file) => pathToFileURL(path.join(ROOT, file)).href;
const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome not found: set CHROME_PATH to its executable.");
  return found;
}

function card(lang) {
  const t = (key) => escapeHtml(dictionaries[lang][key]);
  const rtl = lang === "ar";
  const font = rtl ? '"Cairo"' : '"Plus Jakarta Sans"';
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8">
<style>
@font-face { font-family: "Plus Jakarta Sans"; font-weight: 400 800; src: url("${fileUrl("assets/fonts/plus-jakarta-sans-latin.woff2")}") format("woff2"); }
@font-face { font-family: "Cairo"; font-weight: 400 900; src: url("${fileUrl("assets/fonts/cairo-arabic.woff2")}") format("woff2"); unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFC; }
@font-face { font-family: "Cairo"; font-weight: 400 900; src: url("${fileUrl("assets/fonts/cairo-latin.woff2")}") format("woff2"); unicode-range: U+0000-00FF, U+2000-206F; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body {
  font-family: ${font}, sans-serif;
  color: #fff;
  background:
    radial-gradient(700px 420px at ${rtl ? "88%" : "12%"} -8%, rgba(59, 130, 246, 0.34), transparent 70%),
    radial-gradient(520px 360px at ${rtl ? "8%" : "92%"} 108%, rgba(245, 158, 11, 0.16), transparent 70%),
    #07090E;
  position: relative;
}
.text {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 64px;
  width: 520px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 22px;
}
.brand { display: flex; align-items: center; gap: 14px; font-family: "Plus Jakarta Sans", sans-serif; font-size: 34px; font-weight: 800; letter-spacing: -0.5px; }
.brand img { width: 58px; height: 58px; border-radius: 14px; }
.kicker { font-size: ${rtl ? 23 : 21}px; font-weight: 700; color: #93C5FD; }
h1 { font-size: ${rtl ? 54 : 52}px; line-height: ${rtl ? 1.32 : 1.14}; font-weight: 800; letter-spacing: ${rtl ? "0" : "-1.4px"}; }
h1 span { display: block; }
h1 .gold { color: #F59E0B; }
.chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.chips span {
  padding: 8px 16px;
  border-radius: 999px;
  font-size: ${rtl ? 19 : 18}px;
  font-weight: 700;
  color: #E2E8F0;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.16);
  white-space: nowrap;
}
.shot {
  position: absolute;
  inset-inline-start: 632px;
  top: 112px;
  width: 760px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 40px 90px rgba(0, 0, 0, 0.65), 0 0 0 8px rgba(255, 255, 255, 0.03);
}
.shot img { display: block; width: 100%; }
</style>
</head>
<body>
  <div class="text">
    <div class="brand" dir="ltr"><img src="${fileUrl("assets/logo-512.png")}" alt=""><span>Acadex</span></div>
    <div class="kicker">${t("og_kicker")}</div>
    <h1><span>${t("hero_h1_part1")}</span><span class="gold">${t("hero_h1_part2")}</span></h1>
    <div class="chips"><span>${t("og_chip1")}</span><span>${t("og_chip2")}</span><span>${t("og_chip3")}</span></div>
  </div>
  <div class="shot"><img src="${fileUrl("assets/demo-poster.webp")}" alt=""></div>
</body>
</html>
`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "acadex-og-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(findChrome(), [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(work, "profile")}`,
    "--no-first-run", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank",
  ], { stdio: "ignore" });
  try {
    let socketUrl = null;
    for (let i = 0; i < 60 && !socketUrl; i += 1) {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        socketUrl = (targets.find((target) => target.type === "page") || {}).webSocketDebuggerUrl || null;
      } catch { /* Chrome is still starting */ }
      if (!socketUrl) await sleep(250);
    }
    if (!socketUrl) throw new Error("Chrome did not start.");
    const socket = new WebSocket(socketUrl);
    await new Promise((resolve) => socket.addEventListener("open", resolve));
    let sequence = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    });
    const send = (method, params = {}) => new Promise((resolve) => {
      const id = ++sequence;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
    for (const lang of LANGS) {
      const page = path.join(work, `card-${lang}.html`);
      fs.writeFileSync(page, card(lang));
      await send("Page.navigate", { url: pathToFileURL(page).href });
      await sleep(800);
      await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => Promise.all([...document.images].map((image) => image.decode())))", awaitPromise: true });
      await sleep(300);
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
      const target = path.join(ROOT, `assets/og-${lang}.jpg`);
      fs.writeFileSync(target, Buffer.from(shot.result.data, "base64"));
      console.log(`wrote assets/og-${lang}.jpg (${Math.round(fs.statSync(target).size / 1024)} KB)`);
    }
    socket.close();
  } finally {
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* Chrome may still hold its profile */ }
  }
}

await main();
